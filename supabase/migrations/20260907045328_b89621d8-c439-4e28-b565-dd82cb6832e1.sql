-- 1. Cotas de presente
ALTER TABLE public.gifts ADD COLUMN IF NOT EXISTS shares_total integer NOT NULL DEFAULT 1;
ALTER TABLE public.gifts ADD CONSTRAINT gifts_shares_total_check CHECK (shares_total >= 1);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shares integer NOT NULL DEFAULT 1;

-- 2. RSVP detalhado
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS attending_ceremony boolean NOT NULL DEFAULT true;
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS attending_party boolean NOT NULL DEFAULT true;
ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS dietary_notes text;

-- 3. Repasses aos noivos
CREATE TABLE IF NOT EXISTS public.wedding_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL DEFAULT 'pix',
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_payouts TO authenticated;
GRANT ALL ON public.wedding_payouts TO service_role;

ALTER TABLE public.wedding_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Noivos e admin veem repasses"
  ON public.wedding_payouts FOR SELECT TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin registra repasses"
  ON public.wedding_payouts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin edita repasses"
  ON public.wedding_payouts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin apaga repasses"
  ON public.wedding_payouts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS set_wedding_payouts_updated_at ON public.wedding_payouts;
CREATE TRIGGER set_wedding_payouts_updated_at
  BEFORE UPDATE ON public.wedding_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS wedding_payouts_wedding_idx ON public.wedding_payouts(wedding_id);

-- 4. Resumo financeiro de repasse
CREATE OR REPLACE FUNCTION public.wedding_payout_summary(_wedding_id uuid)
RETURNS TABLE(gross_cents bigint, commission_cents bigint, net_cents bigint, paid_out_cents bigint, pending_cents bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  with o as (
    select coalesce(sum(amount_cents), 0)::bigint as gross,
           coalesce(sum(commission_cents), 0)::bigint as commission
    from public.orders
    where wedding_id = _wedding_id and status = 'paid'
  ), p as (
    select coalesce(sum(amount_cents), 0)::bigint as paid
    from public.wedding_payouts where wedding_id = _wedding_id
  )
  select o.gross,
         o.commission,
         (o.gross - o.commission),
         p.paid,
         (o.gross - o.commission - p.paid)
  from o, p
  where public.owns_wedding(_wedding_id) or public.has_role(auth.uid(), 'admin');
$$;

REVOKE ALL ON FUNCTION public.wedding_payout_summary(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.wedding_payout_summary(uuid) TO authenticated, service_role;

-- 5. Pedido com cotas
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

  select c.fee_cents, c.total_cents, c.installment_cents into ch
    from public.compute_charge(v_amount, p_method, inst) c;

  select full_name, cpf into v_name, v_cpf from public.profiles where id = v_user;

  insert into public.orders
    (wedding_id, gift_id, user_id, guest_name, guest_cpf, payment_method,
     installments, amount_cents, fee_cents, total_cents, message, status, shares)
  values
    (g.wedding_id, g.id, v_user, coalesce(v_name, ''), v_cpf, p_method,
     inst, v_amount, ch.fee_cents, ch.total_cents,
     nullif(trim(coalesce(p_message, '')), ''), 'pending', v_shares)
  returning id into v_order;

  return query select v_order, ch.total_cents, inst;
end;
$function$;

REVOKE ALL ON FUNCTION public.create_gift_order(uuid, text, integer, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.create_gift_order(uuid, text, integer, text, integer) TO authenticated, service_role;
DROP FUNCTION IF EXISTS public.create_gift_order(uuid, text, integer, text);

-- 6. Contagem de cotas ao confirmar pagamento
CREATE OR REPLACE FUNCTION public.sync_gift_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE public.gifts SET purchased_count = purchased_count + GREATEST(COALESCE(NEW.shares, 1), 1) WHERE id = NEW.gift_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    UPDATE public.gifts SET purchased_count = GREATEST(purchased_count - GREATEST(COALESCE(NEW.shares, 1), 1), 0) WHERE id = NEW.gift_id;
  END IF;
  RETURN NEW;
END; $function$;