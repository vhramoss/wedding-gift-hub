-- Refatora pagamentos para NÃO depender do SUPABASE_SERVICE_ROLE_KEY.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (key, value) VALUES ('order_confirm_secret', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.compute_charge(
  p_amount_cents int, p_method text, p_installments int
) RETURNS TABLE (fee_cents int, total_cents int, installment_cents int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare
  n int;
  i numeric;
  amt numeric := p_amount_cents;
  factor numeric;
  inst numeric;
  total numeric;
begin
  if p_method = 'credit' then
    n := greatest(1, least(12, p_installments));
  else
    n := 1;
  end if;
  if p_method <> 'credit' or n <= 1 then
    i := 0;
  elsif n <= 6 then
    i := 0.0199;
  else
    i := 0.0249;
  end if;
  if i = 0 then
    fee_cents := 0;
    total_cents := p_amount_cents;
    installment_cents := round(amt / n)::int;
  else
    factor := (i * power(1 + i, n)) / (power(1 + i, n) - 1);
    inst := round(amt * factor);
    total := inst * n;
    total_cents := total::int;
    fee_cents := (total - amt)::int;
    installment_cents := inst::int;
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_gift_order(
  p_gift_id uuid, p_method text, p_installments int, p_message text
) RETURNS TABLE (order_id uuid, total_cents int, installments int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  g record;
  inst int;
  ch record;
  v_user uuid := auth.uid();
  v_name text;
  v_cpf text;
  v_order uuid;
  v_total int;
  v_inst int;
begin
  if v_user is null then
    raise exception 'Faça login para comprar um presente.';
  end if;
  if p_method not in ('pix','debit','credit') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select id, wedding_id, name, price_cents, quantity, purchased_count, active
    into g from public.gifts where id = p_gift_id for update;
  if not found or coalesce(g.active, false) = false then
    raise exception 'Presente indisponível.';
  end if;
  if g.quantity > 0 and g.purchased_count >= g.quantity then
    raise exception 'Este presente já foi todo comprado.';
  end if;

  if p_method = 'credit' then
    inst := greatest(1, least(12, p_installments));
  else
    inst := 1;
  end if;

  select fee_cents, total_cents, installment_cents into ch
    from public.compute_charge(g.price_cents, p_method, inst);

  select full_name, cpf into v_name, v_cpf from public.profiles where id = v_user;

  insert into public.orders
    (wedding_id, gift_id, user_id, guest_name, guest_cpf, payment_method,
     installments, amount_cents, fee_cents, total_cents, message, status)
  values
    (g.wedding_id, g.id, v_user, coalesce(v_name, ''), v_cpf, p_method,
     inst, g.price_cents, ch.fee_cents, ch.total_cents,
     nullif(trim(coalesce(p_message, '')), ''), 'pending')
  returning id, total_cents, installments into v_order, v_total, v_inst;

  return query select v_order, v_total, v_inst;
end;
$$;
GRANT EXECUTE ON FUNCTION public.create_gift_order(uuid, text, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_pix_payment(
  p_order_id uuid, p_mp_payment_id bigint, p_payload text, p_qr_base64 text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  o record;
  v_user uuid := auth.uid();
  pct numeric;
  comm int;
begin
  if v_user is null then
    raise exception 'Faça login.';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.user_id is distinct from v_user then raise exception 'Acesso negado ao pedido.'; end if;
  if o.payment_method <> 'pix' then raise exception 'Pedido não é Pix.'; end if;
  if o.status <> 'pending' then raise exception 'Pedido não está pendente.'; end if;

  select commission_percent into pct from public.weddings where id = o.wedding_id;
  comm := round(o.total_cents * coalesce(pct, 0) / 100);

  update public.orders set
    mp_payment_id = p_mp_payment_id,
    provider = 'mercadopago',
    pix_payload = p_payload,
    pix_qr_base64 = p_qr_base64,
    commission_cents = comm
  where id = p_order_id;
end;
$$;
GRANT EXECUTE ON FUNCTION public.record_pix_payment(uuid, bigint, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_order_payment(
  p_order_id uuid, p_mp_payment_id bigint, p_status text, p_secret text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  o record;
  expected text;
  new_status text;
  pct numeric;
  comm int;
begin
  select value into expected from public.app_settings where key = 'order_confirm_secret';
  if expected is null or expected = '' or p_secret is distinct from expected then
    raise exception 'Confirmação não autorizada.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then return; end if;

  if p_status = 'approved' then
    new_status := 'paid';
  elsif p_status in ('rejected','cancelled','refunded','charged_back') then
    new_status := 'cancelled';
  else
    return;
  end if;

  if new_status = 'paid' and o.status <> 'paid' then
    select commission_percent into pct from public.weddings where id = o.wedding_id;
    comm := round(o.total_cents * coalesce(pct, 0) / 100);
    update public.orders set
      status = 'paid',
      paid_at = now(),
      mp_payment_id = coalesce(p_mp_payment_id, o.mp_payment_id),
      provider = 'mercadopago',
      commission_cents = coalesce(comm, o.commission_cents)
    where id = p_order_id;
  elsif new_status = 'cancelled' and o.status = 'pending' then
    update public.orders set status = 'cancelled' where id = p_order_id;
  end if;
end;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, bigint, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_order_confirm_secret(p_secret text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Acesso negado.';
  end if;
  insert into public.app_settings (key, value) values ('order_confirm_secret', p_secret)
    on conflict (key) do update set value = excluded.value;
end;
$$;
GRANT EXECUTE ON FUNCTION public.set_order_confirm_secret(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.order_confirm_secret_is_set()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.app_settings where key = 'order_confirm_secret' and value <> '');
$$;
GRANT EXECUTE ON FUNCTION public.order_confirm_secret_is_set() TO authenticated;