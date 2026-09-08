-- 1) Carrinho
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cart_id uuid;
CREATE INDEX IF NOT EXISTS orders_cart_id_idx ON public.orders(cart_id);

-- 2) Personalização
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS bride_photo_url text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS groom_photo_url text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS couple_intro text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS monogram text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS messages_auto_approve boolean NOT NULL DEFAULT true;

-- 3) Recados de visitantes
ALTER TABLE public.wedding_messages ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.post_public_message(p_wedding_id uuid, p_name text, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE w record;
BEGIN
  IF coalesce(trim(p_name), '') = '' OR length(coalesce(trim(p_body), '')) < 3 THEN
    RAISE EXCEPTION 'Informe seu nome e um recado.';
  END IF;
  SELECT published, approval_status, messages_auto_approve INTO w
    FROM public.weddings WHERE id = p_wedding_id;
  IF NOT FOUND OR NOT w.published OR w.approval_status <> 'approved' THEN
    RAISE EXCEPTION 'Este site ainda não está liberado.';
  END IF;
  INSERT INTO public.wedding_messages (wedding_id, user_id, author_name, body, approved)
  VALUES (p_wedding_id, auth.uid(), left(trim(p_name), 80), left(trim(p_body), 1000),
          coalesce(w.messages_auto_approve, true));
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_public_message(uuid, text, text) TO anon, authenticated;

-- 4) Status do pedido com totais do carrinho
DROP FUNCTION IF EXISTS public.public_order_status(uuid);
CREATE OR REPLACE FUNCTION public.public_order_status(p_order_id uuid)
RETURNS TABLE(id uuid, wedding_id uuid, gift_id uuid, user_id uuid, status text,
              payment_method text, installments integer, total_cents integer,
              commission_cents integer, pix_payload text, pix_qr_base64 text,
              gift_name text, cart_id uuid, cart_total_cents integer,
              cart_commission_cents integer, cart_items integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select o.id, o.wedding_id, o.gift_id, o.user_id, o.status, o.payment_method,
         o.installments, o.total_cents, o.commission_cents,
         o.pix_payload, o.pix_qr_base64, g.name, o.cart_id,
         coalesce((select sum(c.total_cents)::int from public.orders c where o.cart_id is not null and c.cart_id = o.cart_id), o.total_cents),
         coalesce((select sum(c.commission_cents)::int from public.orders c where o.cart_id is not null and c.cart_id = o.cart_id), o.commission_cents),
         coalesce((select count(*)::int from public.orders c where o.cart_id is not null and c.cart_id = o.cart_id), 1)
  from public.orders o
  left join public.gifts g on g.id = o.gift_id
  where o.id = p_order_id;
$$;

-- 5) Criação do pedido de carrinho (login opcional)
CREATE OR REPLACE FUNCTION public.create_cart_order(
  p_items jsonb, p_method text, p_installments integer, p_message text,
  p_guest_name text DEFAULT NULL, p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL, p_guest_cpf text DEFAULT NULL)
RETURNS TABLE(cart_id uuid, order_id uuid, total_cents integer, installments integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_user uuid := auth.uid();
  v_name text; v_cpf text; v_email text;
  it jsonb; g record; w record; ch record;
  v_wedding uuid; inst int; v_cart uuid := gen_random_uuid();
  v_shares int; v_available int; v_amount int; v_comm int;
  v_base_total int := 0; v_charged_total int := 0; v_allocated int := 0;
  v_first uuid; v_order uuid; v_item_total int; v_n int; v_i int := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Seu carrinho está vazio.';
  end if;
  if p_method not in ('pix','debit','credit') then
    raise exception 'Forma de pagamento inválida.';
  end if;

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

  -- Valida itens e calcula a base
  for it in select * from jsonb_array_elements(p_items) loop
    select id, wedding_id, price_cents, quantity, purchased_count, active, shares_total
      into g from public.gifts where id = (it->>'gift_id')::uuid for update;
    if not found or coalesce(g.active, false) = false then
      raise exception 'Um dos presentes está indisponível.';
    end if;
    if v_wedding is null then
      v_wedding := g.wedding_id;
    elsif v_wedding <> g.wedding_id then
      raise exception 'Os presentes precisam ser do mesmo casamento.';
    end if;

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

    v_base_total := v_base_total + v_amount;
    v_rows := v_rows || jsonb_build_object('gift_id', g.id, 'shares', v_shares, 'amount', v_amount);
  end loop;

  select approval_status, published, commission_percent, commission_paid_by
    into w from public.weddings where id = v_wedding;
  if w.approval_status is distinct from 'approved' or not w.published then
    raise exception 'Esta lista de presentes ainda não está liberada.';
  end if;

  if p_method = 'credit' then inst := greatest(1, least(12, p_installments)); else inst := 1; end if;

  v_comm := greatest(round(v_base_total * coalesce(w.commission_percent, 0) / 100)::int, 0);
  select c.total_cents into v_charged_total
    from public.compute_charge(
      case when coalesce(w.commission_paid_by,'couple') = 'guest'
           then v_base_total + v_comm else v_base_total end,
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
       greatest(round(v_amount * coalesce(w.commission_percent, 0) / 100)::int, 0), v_cart)
    returning id into v_order;
    if v_first is null then v_first := v_order; end if;
  end loop;

  return query select v_cart, v_first, v_charged_total, inst;
end;
$$;

GRANT EXECUTE ON FUNCTION public.create_cart_order(jsonb, text, integer, text, text, text, text, text) TO anon, authenticated;

-- 6) Pagamento aplicado a todo o carrinho
CREATE OR REPLACE FUNCTION public.record_pix_payment(p_order_id uuid, p_mp_payment_id bigint, p_payload text, p_qr_base64 text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare o record; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Faça login.'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.user_id is distinct from v_user then raise exception 'Acesso negado ao pedido.'; end if;
  if o.payment_method <> 'pix' then raise exception 'Pedido não é Pix.'; end if;
  if o.status <> 'pending' then raise exception 'Pedido não está pendente.'; end if;

  update public.orders set mp_payment_id = p_mp_payment_id, provider = 'mercadopago',
    pix_payload = p_payload, pix_qr_base64 = p_qr_base64
  where id = p_order_id or (o.cart_id is not null and cart_id = o.cart_id);
end;
$$;

CREATE OR REPLACE FUNCTION public.record_public_pix_payment(p_order_id uuid, p_mp_payment_id bigint, p_payload text, p_qr_base64 text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare o record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.user_id is not null then raise exception 'Pedido não é de visitante.'; end if;
  if o.payment_method <> 'pix' or o.status <> 'pending' then
    raise exception 'Pedido não está aguardando Pix.';
  end if;
  update public.orders set mp_payment_id = p_mp_payment_id, provider = 'mercadopago',
    pix_payload = p_payload, pix_qr_base64 = p_qr_base64
  where id = p_order_id or (o.cart_id is not null and cart_id = o.cart_id);
end;
$$;

CREATE OR REPLACE FUNCTION public.confirm_order_payment(p_order_id uuid, p_mp_payment_id bigint, p_status text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  o record; expected text; new_status text; pct numeric; comm int; r record;
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

  select commission_percent into pct from public.weddings where id = o.wedding_id;

  for r in
    select * from public.orders
     where id = p_order_id or (o.cart_id is not null and cart_id = o.cart_id)
     for update
  loop
    if new_status = 'paid' and r.status <> 'paid' then
      if coalesce(r.commission_cents, 0) > 0 then
        comm := r.commission_cents;
      else
        comm := round(r.amount_cents * coalesce(pct, 0) / 100);
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
$$;

CREATE OR REPLACE FUNCTION public.record_order_split(p_order_id uuid, p_application_fee_cents integer, p_seller_mp_user_id bigint, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE expected text; o record;
BEGIN
  SELECT value INTO expected FROM public.app_settings WHERE key = 'order_confirm_secret';
  IF expected IS NULL OR expected = '' OR p_secret IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Operação não autorizada.';
  END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.orders
     SET application_fee_cents = greatest(coalesce(p_application_fee_cents, 0), 0),
         seller_mp_user_id = p_seller_mp_user_id
   WHERE id = p_order_id;
  IF o.cart_id IS NOT NULL THEN
    UPDATE public.orders
       SET seller_mp_user_id = p_seller_mp_user_id
     WHERE cart_id = o.cart_id AND id <> p_order_id;
  END IF;
END;
$$;