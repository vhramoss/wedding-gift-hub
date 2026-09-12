ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS require_login boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.wedding_fee_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  up_to_cents integer,
  percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_fee_tiers TO authenticated;
GRANT ALL ON public.wedding_fee_tiers TO service_role;
ALTER TABLE public.wedding_fee_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casal e admin veem faixas" ON public.wedding_fee_tiers FOR SELECT TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia faixas" ON public.wedding_fee_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER wedding_fee_tiers_updated BEFORE UPDATE ON public.wedding_fee_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS wedding_fee_tiers_wedding_idx ON public.wedding_fee_tiers(wedding_id);

CREATE OR REPLACE FUNCTION public.commission_percent_for(_wedding_id uuid, _amount_cents integer)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT t.percent FROM public.wedding_fee_tiers t
      WHERE t.wedding_id = _wedding_id
        AND (t.up_to_cents IS NULL OR _amount_cents <= t.up_to_cents)
      ORDER BY t.up_to_cents ASC NULLS LAST
      LIMIT 1),
    (SELECT w.commission_percent FROM public.weddings w WHERE w.id = _wedding_id),
    0);
$$;

CREATE TABLE IF NOT EXISTS public.wedding_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'aviso',
  title text NOT NULL,
  body text NOT NULL,
  send_on date,
  audience text NOT NULL DEFAULT 'todos',
  sent_at timestamptz,
  recipients_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_reminders TO authenticated;
GRANT ALL ON public.wedding_reminders TO service_role;
ALTER TABLE public.wedding_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casal gerencia lembretes" ON public.wedding_reminders FOR ALL TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER wedding_reminders_updated BEFORE UPDATE ON public.wedding_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS wedding_reminders_wedding_idx ON public.wedding_reminders(wedding_id);

CREATE OR REPLACE FUNCTION public.create_gift_order(p_gift_id uuid, p_method text, p_installments integer, p_message text, p_shares integer DEFAULT 1)
 RETURNS TABLE(order_id uuid, total_cents integer, installments integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  g record; inst int; ch record; v_user uuid := auth.uid();
  v_name text; v_cpf text; v_order uuid; v_shares int; v_available int;
  v_share_price int; v_amount int; v_base int; v_comm int := 0; w record;
begin
  if v_user is null then raise exception 'Faça login para comprar um presente.'; end if;
  if p_method not in ('pix','debit','credit') then raise exception 'Forma de pagamento inválida.'; end if;

  select id, wedding_id, name, price_cents, quantity, purchased_count, active, shares_total
    into g from public.gifts where id = p_gift_id for update;
  if not found or coalesce(g.active, false) = false then raise exception 'Presente indisponível.'; end if;

  select approval_status, commission_percent, commission_paid_by
    into w from public.weddings where id = g.wedding_id;
  if w.approval_status is distinct from 'approved' then
    raise exception 'Esta lista de presentes ainda não está liberada.';
  end if;

  if coalesce(g.shares_total, 1) > 1 then
    v_available := g.shares_total - coalesce(g.purchased_count, 0);
    if v_available <= 0 then raise exception 'Todas as cotas deste presente já foram compradas.'; end if;
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

  if p_method = 'credit' then inst := greatest(1, least(12, p_installments)); else inst := 1; end if;

  v_comm := greatest(round(v_amount * public.commission_percent_for(g.wedding_id, v_amount) / 100)::int, 0);

  if coalesce(w.commission_paid_by, 'couple') = 'guest' then v_base := v_amount + v_comm; else v_base := v_amount; end if;

  select c.fee_cents, c.total_cents, c.installment_cents into ch from public.compute_charge(v_base, p_method, inst) c;
  select full_name, cpf into v_name, v_cpf from public.profiles where id = v_user;

  insert into public.orders
    (wedding_id, gift_id, user_id, guest_name, guest_cpf, payment_method,
     installments, amount_cents, fee_cents, total_cents, message, status, shares, commission_cents)
  values
    (g.wedding_id, g.id, v_user, coalesce(v_name, ''), v_cpf, p_method,
     inst, v_amount, ch.total_cents - v_amount, ch.total_cents,
     nullif(trim(coalesce(p_message, '')), ''), 'pending', v_shares, v_comm)
  returning id into v_order;

  return query select v_order, ch.total_cents, inst;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_public_gift_order(p_gift_id uuid, p_method text, p_installments integer, p_message text, p_shares integer, p_guest_name text, p_guest_email text, p_guest_phone text DEFAULT NULL::text, p_guest_cpf text DEFAULT NULL::text)
 RETURNS TABLE(order_id uuid, total_cents integer, installments integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  g record; w record; ch record; inst int; v_shares int; v_available int;
  v_share_price int; v_amount int; v_base int; v_comm int := 0; v_order uuid;
begin
  if coalesce(trim(p_guest_name), '') = '' or coalesce(trim(p_guest_email), '') = '' then
    raise exception 'Informe seu nome e e-mail.';
  end if;
  if p_method not in ('pix','debit','credit') then raise exception 'Forma de pagamento inválida.'; end if;

  select id, wedding_id, name, price_cents, quantity, purchased_count, active, shares_total
    into g from public.gifts where id = p_gift_id for update;
  if not found or coalesce(g.active, false) = false then raise exception 'Presente indisponível.'; end if;

  select approval_status, commission_percent, commission_paid_by, published
    into w from public.weddings where id = g.wedding_id;
  if w.approval_status is distinct from 'approved' or not w.published then
    raise exception 'Esta lista de presentes ainda não está liberada.';
  end if;

  if coalesce(g.shares_total, 1) > 1 then
    v_available := g.shares_total - coalesce(g.purchased_count, 0);
    if v_available <= 0 then raise exception 'Todas as cotas já foram compradas.'; end if;
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

  if p_method = 'credit' then inst := greatest(1, least(12, p_installments)); else inst := 1; end if;

  v_comm := greatest(round(v_amount * public.commission_percent_for(g.wedding_id, v_amount) / 100)::int, 0);
  if coalesce(w.commission_paid_by, 'couple') = 'guest' then v_base := v_amount + v_comm; else v_base := v_amount; end if;

  select c.fee_cents, c.total_cents, c.installment_cents into ch from public.compute_charge(v_base, p_method, inst) c;

  insert into public.orders
    (wedding_id, gift_id, user_id, guest_name, guest_cpf, guest_email, guest_phone,
     payment_method, installments, amount_cents, fee_cents, total_cents, message,
     status, shares, commission_cents)
  values
    (g.wedding_id, g.id, null, trim(p_guest_name), nullif(trim(coalesce(p_guest_cpf,'')), ''),
     lower(trim(p_guest_email)), nullif(trim(coalesce(p_guest_phone,'')), ''),
     p_method, inst, v_amount, ch.total_cents - v_amount, ch.total_cents,
     nullif(trim(coalesce(p_message, '')), ''), 'pending', v_shares, v_comm)
  returning id into v_order;

  return query select v_order, ch.total_cents, inst;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_cart_order(p_items jsonb, p_method text, p_installments integer, p_message text, p_guest_name text DEFAULT NULL::text, p_guest_email text DEFAULT NULL::text, p_guest_phone text DEFAULT NULL::text, p_guest_cpf text DEFAULT NULL::text)
 RETURNS TABLE(cart_id uuid, order_id uuid, total_cents integer, installments integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_name text; v_cpf text; v_email text;
  it jsonb; g record; w record;
  v_wedding uuid; inst int; v_cart uuid := gen_random_uuid();
  v_shares int; v_available int; v_amount int; v_comm int; v_comm_total int := 0;
  v_base_total int := 0; v_charged_total int := 0; v_allocated int := 0;
  v_first uuid; v_order uuid; v_item_total int; v_n int; v_i int := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Seu carrinho está vazio.'; end if;
  if p_method not in ('pix','debit','credit') then raise exception 'Forma de pagamento inválida.'; end if;

  if v_user is not null then
    select full_name, cpf into v_name, v_cpf from public.profiles where id = v_user;
  else
    if coalesce(trim(p_guest_name), '') = '' or coalesce(trim(p_guest_email), '') = '' then
      raise exception 'Informe seu nome e e-mail.';
    end if;
    v_name := trim(p_guest_name);
    v_cpf := nullif(trim(coalesce(p_guest_cpf, '')), '');
    v_email := lower(trim(p_guest_email));
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select id, wedding_id, price_cents, quantity, purchased_count, active, shares_total
      into g from public.gifts where id = (it->>'gift_id')::uuid for update;
    if not found or coalesce(g.active, false) = false then raise exception 'Um dos presentes está indisponível.'; end if;
    if v_wedding is null then v_wedding := g.wedding_id;
    elsif v_wedding <> g.wedding_id then raise exception 'Os presentes precisam ser do mesmo casamento.'; end if;

    if coalesce(g.shares_total, 1) > 1 then
      v_available := g.shares_total - coalesce(g.purchased_count, 0);
      if v_available <= 0 then raise exception 'Todas as cotas de um presente já foram compradas.'; end if;
      v_shares := greatest(1, least(coalesce((it->>'shares')::int, 1), v_available));
      v_amount := ceil(g.price_cents::numeric / g.shares_total)::int * v_shares;
    else
      if g.quantity > 0 and g.purchased_count >= g.quantity then
        raise exception 'Um dos presentes já foi comprado.';
      end if;
      v_shares := 1;
      v_amount := g.price_cents;
    end if;

    v_comm := greatest(round(v_amount * public.commission_percent_for(g.wedding_id, v_amount) / 100)::int, 0);
    v_base_total := v_base_total + v_amount;
    v_comm_total := v_comm_total + v_comm;
    v_rows := v_rows || jsonb_build_object('gift_id', g.id, 'shares', v_shares, 'amount', v_amount, 'comm', v_comm);
  end loop;

  select approval_status, published, commission_percent, commission_paid_by
    into w from public.weddings where id = v_wedding;
  if w.approval_status is distinct from 'approved' or not w.published then
    raise exception 'Esta lista de presentes ainda não está liberada.';
  end if;

  if p_method = 'credit' then inst := greatest(1, least(12, p_installments)); else inst := 1; end if;

  select c.total_cents into v_charged_total
    from public.compute_charge(
      case when coalesce(w.commission_paid_by,'couple') = 'guest'
           then v_base_total + v_comm_total else v_base_total end,
      p_method, inst) c;

  v_n := jsonb_array_length(v_rows);
  for it in select * from jsonb_array_elements(v_rows) loop
    v_i := v_i + 1;
    v_amount := (it->>'amount')::int;
    if v_i = v_n then
      v_item_total := v_charged_total - v_allocated;
    else
      v_item_total := round(v_charged_total::numeric * v_amount / v_base_total)::int;
      v_allocated := v_allocated + v_item_total;
    end if;

    insert into public.orders
      (wedding_id, gift_id, user_id, guest_name, guest_cpf, guest_email, guest_phone,
       payment_method, installments, amount_cents, fee_cents, total_cents, message,
       status, shares, commission_cents, cart_id)
    values
      (v_wedding, (it->>'gift_id')::uuid, v_user, coalesce(v_name, ''), v_cpf, v_email,
       nullif(trim(coalesce(p_guest_phone, '')), ''),
       p_method, inst, v_amount, greatest(v_item_total - v_amount, 0), v_item_total,
       nullif(trim(coalesce(p_message, '')), ''), 'pending', (it->>'shares')::int,
       (it->>'comm')::int, v_cart)
    returning id into v_order;
    if v_first is null then v_first := v_order; end if;
  end loop;

  return query select v_cart, v_first, v_charged_total, inst;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_order_payment(p_order_id uuid, p_mp_payment_id bigint, p_status text, p_secret text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  o record; expected text; new_status text; comm int; r record;
begin
  select value into expected from public.app_settings where key = 'order_confirm_secret';
  if expected is null or expected = '' or p_secret is distinct from expected then
    raise exception 'Confirmação não autorizada.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then return; end if;

  if p_status = 'approved' then new_status := 'paid';
  elsif p_status in ('rejected','cancelled','refunded','charged_back') then new_status := 'cancelled';
  else return; end if;

  for r in
    select * from public.orders
     where id = p_order_id or (o.cart_id is not null and cart_id = o.cart_id)
     for update
  loop
    if new_status = 'paid' and r.status <> 'paid' then
      if coalesce(r.commission_cents, 0) > 0 then
        comm := r.commission_cents;
      else
        comm := round(r.amount_cents * public.commission_percent_for(r.wedding_id, r.amount_cents) / 100)::int;
      end if;
      update public.orders set
        status = 'paid', paid_at = now(),
        mp_payment_id = coalesce(p_mp_payment_id, r.mp_payment_id),
        provider = 'mercadopago', commission_cents = comm
      where id = r.id;
    elsif new_status = 'cancelled' and r.status = 'pending' then
      update public.orders set status = 'cancelled' where id = r.id;
    end if;
  end loop;
end;
$function$;