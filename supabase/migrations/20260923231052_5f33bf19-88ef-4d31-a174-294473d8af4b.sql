ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS planner_name text,
  ADD COLUMN IF NOT EXISTS planner_contact text,
  ADD COLUMN IF NOT EXISTS planner_pix text,
  ADD COLUMN IF NOT EXISTS planner_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fees_accepted_at timestamptz;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS planner_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.wedding_guests ADD COLUMN IF NOT EXISTS cpf text, ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS wedding_guests_wedding_cpf_uidx ON public.wedding_guests(wedding_id, cpf) WHERE cpf IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_wedding_admin_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.approval_status := OLD.approval_status; NEW.approval_note := OLD.approval_note;
  NEW.approved_at := OLD.approved_at; NEW.approved_by := OLD.approved_by;
  NEW.plan := OLD.plan; NEW.plan_fee_cents := OLD.plan_fee_cents; NEW.plan_billing := OLD.plan_billing;
  NEW.plan_paid := OLD.plan_paid; NEW.plan_started_on := OLD.plan_started_on; NEW.plan_notes := OLD.plan_notes;
  NEW.commission_percent := OLD.commission_percent; NEW.commission_paid_by := OLD.commission_paid_by;
  NEW.planner_name := OLD.planner_name; NEW.planner_contact := OLD.planner_contact;
  NEW.planner_pix := OLD.planner_pix; NEW.planner_percent := OLD.planner_percent;
  IF OLD.fees_accepted_at IS NOT NULL THEN NEW.fees_accepted_at := OLD.fees_accepted_at; END IF;
  IF OLD.approval_status <> 'approved' THEN NEW.published := false; END IF;
  RETURN NEW;
END; $$;

-- Faixas padrão para novos casamentos
CREATE OR REPLACE FUNCTION public.seed_default_fee_tiers()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.wedding_fee_tiers (wedding_id, up_to_cents, percent) VALUES
    (NEW.id, 24999, 20), (NEW.id, 100000, 10), (NEW.id, NULL, 5);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS weddings_seed_fee_tiers ON public.weddings;
CREATE TRIGGER weddings_seed_fee_tiers AFTER INSERT ON public.weddings
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_fee_tiers();

INSERT INTO public.wedding_fee_tiers (wedding_id, up_to_cents, percent)
SELECT w.id, t.up, t.pct FROM public.weddings w
CROSS JOIN (VALUES (24999, 20::numeric), (100000, 10::numeric), (NULL::int, 5::numeric)) t(up, pct)
WHERE NOT EXISTS (SELECT 1 FROM public.wedding_fee_tiers f WHERE f.wedding_id = w.id);

-- Faixas visíveis para os noivos (somente leitura) e público
CREATE OR REPLACE FUNCTION public.wedding_fee_schedule(_wedding_id uuid)
 RETURNS TABLE(up_to_cents integer, percent numeric, paid_by text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT t.up_to_cents, t.percent, w.commission_paid_by
  FROM public.wedding_fee_tiers t JOIN public.weddings w ON w.id = t.wedding_id
  WHERE t.wedding_id = _wedding_id AND (public.owns_wedding(_wedding_id) OR public.has_role(auth.uid(),'admin'))
  ORDER BY t.up_to_cents ASC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.wedding_fee_schedule(uuid) TO authenticated;

-- Comissão do cerimonialista registrada no pagamento
CREATE OR REPLACE FUNCTION public.set_order_planner_cents()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE pct numeric;
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT planner_percent INTO pct FROM public.weddings WHERE id = NEW.wedding_id;
    NEW.planner_cents := greatest(round(coalesce(NEW.commission_cents,0) * coalesce(pct,0) / 100)::int, 0);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS orders_planner_cents ON public.orders;
CREATE TRIGGER orders_planner_cents BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_planner_cents();

-- Convidado se cadastra pelo convite com nome e CPF
CREATE OR REPLACE FUNCTION public.register_invited_guest(p_wedding_id uuid, p_name text, p_cpf text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_cpf text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g'); v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
  IF length(v_cpf) <> 11 THEN RAISE EXCEPTION 'CPF inválido.'; END IF;
  IF coalesce(trim(p_name),'') = '' THEN RAISE EXCEPTION 'Informe seu nome completo.'; END IF;
  UPDATE public.profiles SET full_name = trim(p_name), cpf = v_cpf WHERE id = auth.uid();
  SELECT id INTO v_id FROM public.wedding_guests WHERE wedding_id = p_wedding_id AND cpf = v_cpf;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.wedding_guests
     WHERE wedding_id = p_wedding_id AND cpf IS NULL AND name_norm = public.norm_txt(trim(p_name)) LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE public.wedding_guests SET cpf = v_cpf, user_id = auth.uid() WHERE id = v_id;
    ELSE
      INSERT INTO public.wedding_guests (wedding_id, name, name_norm, cpf, user_id, group_label)
      VALUES (p_wedding_id, trim(p_name), public.norm_txt(trim(p_name)), v_cpf, auth.uid(), 'Convite QR')
      RETURNING id INTO v_id;
    END IF;
  ELSE
    UPDATE public.wedding_guests SET user_id = auth.uid() WHERE id = v_id;
  END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.register_invited_guest(uuid,text,text) TO authenticated;

-- Busca também por CPF
CREATE OR REPLACE FUNCTION public.search_wedding_guests(p_wedding_id uuid, p_query text)
 RETURNS TABLE(id uuid, name text, group_label text, max_companions integer, attending boolean, companions integer, attending_ceremony boolean, attending_party boolean, dietary_notes text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select g.id, g.name, g.group_label, g.max_companions, g.attending, g.companions,
         g.attending_ceremony, g.attending_party, g.dietary_notes
  from public.wedding_guests g join public.weddings w on w.id = g.wedding_id
  where g.wedding_id = p_wedding_id and w.published and w.approval_status = 'approved'
    and (
      (length(regexp_replace(coalesce(p_query,''), '\D', '', 'g')) = 11
        and g.cpf = regexp_replace(p_query, '\D', '', 'g'))
      or (length(regexp_replace(coalesce(p_query,''), '\D', '', 'g')) = 0
        and length(coalesce(trim(p_query), '')) >= 3
        and g.name_norm like '%' || public.norm_txt(trim(p_query)) || '%')
    )
  order by g.name limit 10
$$;