ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS commission_paid_by text NOT NULL DEFAULT 'couple';

ALTER TABLE public.weddings
  DROP CONSTRAINT IF EXISTS weddings_commission_paid_by_check;
ALTER TABLE public.weddings
  ADD CONSTRAINT weddings_commission_paid_by_check
  CHECK (commission_paid_by IN ('couple','guest'));

CREATE OR REPLACE FUNCTION public.protect_wedding_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.approval_status := OLD.approval_status;
  NEW.approval_note := OLD.approval_note;
  NEW.approved_at := OLD.approved_at;
  NEW.approved_by := OLD.approved_by;
  NEW.plan := OLD.plan;
  NEW.plan_fee_cents := OLD.plan_fee_cents;
  NEW.plan_billing := OLD.plan_billing;
  NEW.plan_paid := OLD.plan_paid;
  NEW.plan_started_on := OLD.plan_started_on;
  NEW.plan_notes := OLD.plan_notes;
  NEW.commission_percent := OLD.commission_percent;
  NEW.commission_paid_by := OLD.commission_paid_by;
  IF OLD.approval_status <> 'approved' THEN
    NEW.published := false;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_wedding_plan(_wedding_id uuid, _plan text, _fee_cents integer, _billing text, _paid boolean, _started_on date DEFAULT NULL::date, _notes text DEFAULT NULL::text, _commission_percent numeric DEFAULT NULL::numeric, _commission_paid_by text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF _plan NOT IN ('commission','hybrid','fixed') THEN
    RAISE EXCEPTION 'Plano inválido.';
  END IF;
  IF _billing NOT IN ('once','monthly') THEN
    RAISE EXCEPTION 'Cobrança inválida.';
  END IF;
  IF _commission_paid_by IS NOT NULL AND _commission_paid_by NOT IN ('couple','guest') THEN
    RAISE EXCEPTION 'Opção de taxa inválida.';
  END IF;
  UPDATE public.weddings
     SET plan = _plan,
         plan_fee_cents = greatest(coalesce(_fee_cents, 0), 0),
         plan_billing = _billing,
         plan_paid = coalesce(_paid, false),
         plan_started_on = _started_on,
         plan_notes = nullif(trim(coalesce(_notes, '')), ''),
         commission_percent = CASE
           WHEN _commission_percent IS NULL THEN commission_percent
           ELSE greatest(least(_commission_percent, 100), 0)
         END,
         commission_paid_by = coalesce(_commission_paid_by, commission_paid_by)
   WHERE id = _wedding_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_gift_order(p_gift_id uuid, p_method text, p_installments integer, p_message text, p_shares integer DEFAULT 1)
 RETURNS TABLE(order_id uuid, total_cents integer, installments integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g record;
  inst int;
  ch record;
  v_user uuid := auth.uid();
  v_name text;
  v_cpf text;
  v_order uuid;
  v_shares int;
  v_available int;
  v_share_price int;
  v_amount int;
  v_base int;
  v_comm int := 0;
  w record;
begin
  if v_user is null then
    raise exception 'Faça login para comprar um presente.';
  end if;
  if p_method not in ('pix','debit','credit') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select id, wedding_id, name, price_cents, quantity, purchased_count, active, shares_total
    into g from public.gifts where id = p_gift_id for update;
  if not found or coalesce(g.active, false) = false then
    raise exception 'Presente indisponível.';
  end if;

  select approval_status, commission_percent, commission_paid_by
    into w from public.weddings where id = g.wedding_id;
  if w.approval_status is distinct from 'approved' then
    raise exception 'Esta lista de presentes ainda não está liberada.';
  end if;

  if coalesce(g.shares_total, 1) > 1 then
    v_available := g.shares_total - coalesce(g.purchased_count, 0);
    if v_available <= 0 then
      raise exception 'Todas as cotas deste presente já foram compradas.';
    end if;
    v_shares := greatest(1, least(coalesce(p_shares, 1), v_available));
    v_share_price := ceil(g.price_cents::numeric / g.shares_total)::int;
    v_amount := v_share_price * v_shares;
  else
    if g.quantity > 0 and g.purchased_count >= g.quantity then
      raise exception 'Este presente já foi todo comprado.';
    end if;
    v_shares := 1;
    v_amount := g.price_cents;
  end if;

  if p_method = 'credit' then
    inst := greatest(1, least(12, p_installments));
  else
    inst := 1;
  end if;

  -- Comissão da plataforma
  v_comm := greatest(round(v_amount * coalesce(w.commission_percent, 0) / 100)::int, 0);

  -- Quando o convidado paga a taxa, ela entra na base cobrada.
  if coalesce(w.commission_paid_by, 'couple') = 'guest' then
    v_base := v_amount + v_comm;
  else
    v_base := v_amount;
  end if;

  select c.fee_cents, c.total_cents, c.installment_cents into ch
    from public.compute_charge(v_base, p_method, inst) c;

  select full_name, cpf into v_name, v_cpf from public.profiles where id = v_user;

  insert into public.orders
    (wedding_id, gift_id, user_id, guest_name, guest_cpf, payment_method,
     installments, amount_cents, fee_cents, total_cents, message, status, shares,
     commission_cents)
  values
    (g.wedding_id, g.id, v_user, coalesce(v_name, ''), v_cpf, p_method,
     inst, v_amount, ch.total_cents - v_amount, ch.total_cents,
     nullif(trim(coalesce(p_message, '')), ''), 'pending', v_shares,
     v_comm)
  returning id into v_order;

  return query select v_order, ch.total_cents, inst;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_pix_payment(p_order_id uuid, p_mp_payment_id bigint, p_payload text, p_qr_base64 text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o record;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Faça login.';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.user_id is distinct from v_user then raise exception 'Acesso negado ao pedido.'; end if;
  if o.payment_method <> 'pix' then raise exception 'Pedido não é Pix.'; end if;
  if o.status <> 'pending' then raise exception 'Pedido não está pendente.'; end if;

  update public.orders set
    mp_payment_id = p_mp_payment_id,
    provider = 'mercadopago',
    pix_payload = p_payload,
    pix_qr_base64 = p_qr_base64
  where id = p_order_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_order_payment(p_order_id uuid, p_mp_payment_id bigint, p_status text, p_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if coalesce(o.commission_cents, 0) > 0 then
      comm := o.commission_cents;
    else
      select commission_percent into pct from public.weddings where id = o.wedding_id;
      comm := round(o.amount_cents * coalesce(pct, 0) / 100);
    end if;
    update public.orders set
      status = 'paid',
      paid_at = now(),
      mp_payment_id = coalesce(p_mp_payment_id, o.mp_payment_id),
      provider = 'mercadopago',
      commission_cents = comm
    where id = p_order_id;
  elsif new_status = 'cancelled' and o.status = 'pending' then
    update public.orders set status = 'cancelled' where id = p_order_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_order_split(p_order_id uuid, p_application_fee_cents integer, p_seller_mp_user_id bigint, p_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE expected text;
BEGIN
  SELECT value INTO expected FROM public.app_settings WHERE key = 'order_confirm_secret';
  IF expected IS NULL OR expected = '' OR p_secret IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Operação não autorizada.';
  END IF;
  UPDATE public.orders
     SET application_fee_cents = greatest(coalesce(p_application_fee_cents, 0), 0),
         seller_mp_user_id = p_seller_mp_user_id
   WHERE id = p_order_id;
END;
$function$;