ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'commission',
  ADD COLUMN IF NOT EXISTS plan_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_billing text NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS plan_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_started_on date,
  ADD COLUMN IF NOT EXISTS plan_notes text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weddings_approval_status_check') THEN
    ALTER TABLE public.weddings ADD CONSTRAINT weddings_approval_status_check
      CHECK (approval_status IN ('pending','approved','rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weddings_plan_check') THEN
    ALTER TABLE public.weddings ADD CONSTRAINT weddings_plan_check
      CHECK (plan IN ('commission','hybrid','fixed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weddings_plan_billing_check') THEN
    ALTER TABLE public.weddings ADD CONSTRAINT weddings_plan_billing_check
      CHECK (plan_billing IN ('once','monthly'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weddings_plan_fee_check') THEN
    ALTER TABLE public.weddings ADD CONSTRAINT weddings_plan_fee_check
      CHECK (plan_fee_cents >= 0);
  END IF;
END $$;

-- Owners may not change approval or plan fields themselves
CREATE OR REPLACE FUNCTION public.protect_wedding_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF OLD.approval_status <> 'approved' THEN
    NEW.published := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS weddings_protect_admin_fields ON public.weddings;
CREATE TRIGGER weddings_protect_admin_fields
  BEFORE UPDATE ON public.weddings
  FOR EACH ROW EXECUTE FUNCTION public.protect_wedding_admin_fields();

-- Guests only see approved weddings
DROP POLICY IF EXISTS "anon weddings readable" ON public.weddings;
CREATE POLICY "anon weddings readable" ON public.weddings FOR SELECT TO anon
  USING (published AND approval_status = 'approved');

DROP POLICY IF EXISTS "auth weddings readable" ON public.weddings;
CREATE POLICY "auth weddings readable" ON public.weddings FOR SELECT TO authenticated
  USING (
    (published AND approval_status = 'approved')
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admin approval / plan management
CREATE OR REPLACE FUNCTION public.set_wedding_approval(
  _wedding_id uuid,
  _status text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Situação inválida.';
  END IF;
  UPDATE public.weddings
     SET approval_status = _status,
         approval_note = nullif(trim(coalesce(_note, '')), ''),
         approved_at = CASE WHEN _status = 'approved' THEN now() ELSE NULL END,
         approved_by = CASE WHEN _status = 'approved' THEN auth.uid() ELSE NULL END,
         published = CASE WHEN _status = 'approved' THEN published ELSE false END
   WHERE id = _wedding_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_wedding_approval(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_wedding_approval(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_wedding_plan(
  _wedding_id uuid,
  _plan text,
  _fee_cents integer,
  _billing text,
  _paid boolean,
  _started_on date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _commission_percent numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
         END
   WHERE id = _wedding_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_wedding_plan(uuid, text, integer, text, boolean, date, text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.set_wedding_plan(uuid, text, integer, text, boolean, date, text, numeric) TO authenticated;

-- Self-service weddings start pending and unpublished
CREATE OR REPLACE FUNCTION public.create_own_wedding(
  p_bride text,
  p_groom text,
  p_slug text,
  p_date date DEFAULT NULL
)
RETURNS TABLE(wedding_id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_base text;
  v_slug text;
  v_i int := 1;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Faça login para criar o casamento.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.weddings w WHERE w.owner_id = v_user) THEN
    RAISE EXCEPTION 'Você já tem um casamento criado.';
  END IF;
  IF coalesce(trim(p_bride), '') = '' OR coalesce(trim(p_groom), '') = '' THEN
    RAISE EXCEPTION 'Informe o nome dos dois noivos.';
  END IF;

  v_base := regexp_replace(lower(coalesce(nullif(trim(p_slug), ''), trim(p_bride) || '-e-' || trim(p_groom))), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  IF v_base = '' THEN v_base := 'nosso-casamento'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.weddings w WHERE w.slug = v_slug) LOOP
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  END LOOP;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.weddings (owner_id, slug, bride_name, groom_name, wedding_date, published, approval_status)
  VALUES (v_user, v_slug, trim(p_bride), trim(p_groom), p_date, false, 'pending')
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_slug;
END;
$$;

-- Block gift purchases while the wedding is not released
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
  v_approved text;
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

  select approval_status into v_approved from public.weddings where id = g.wedding_id;
  if v_approved is distinct from 'approved' then
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