ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS notify_whatsapp text;

CREATE TABLE IF NOT EXISTS public.wedding_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.wedding_notifications TO authenticated;
GRANT ALL ON public.wedding_notifications TO service_role;
ALTER TABLE public.wedding_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read notifications" ON public.wedding_notifications
  FOR SELECT TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owners update notifications" ON public.wedding_notifications
  FOR UPDATE TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owners delete notifications" ON public.wedding_notifications
  FOR DELETE TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS wedding_notifications_wedding_idx
  ON public.wedding_notifications (wedding_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g_name text;
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT name INTO g_name FROM public.gifts WHERE id = NEW.gift_id;
    INSERT INTO public.wedding_notifications (wedding_id, kind, title, body)
    VALUES (
      NEW.wedding_id,
      'gift',
      'Novo presente recebido',
      coalesce(nullif(trim(NEW.guest_name), ''), 'Um convidado') || ' presenteou ' ||
      coalesce(g_name, 'um presente') || ' — R$ ' ||
      to_char(NEW.amount_cents / 100.0, 'FM999G999G990D00')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify_paid ON public.orders;
CREATE TRIGGER orders_notify_paid
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_paid();

CREATE OR REPLACE FUNCTION public.notify_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wedding_notifications (wedding_id, kind, title, body)
  VALUES (
    NEW.wedding_id,
    'rsvp',
    CASE WHEN NEW.attending THEN 'Nova confirmação de presença' ELSE 'Convidado não poderá ir' END,
    coalesce(nullif(trim(NEW.guest_name), ''), 'Um convidado') ||
    CASE WHEN NEW.attending
      THEN ' confirmou presença (' || NEW.companions || ' acompanhante(s))'
      ELSE ' informou que não poderá comparecer' END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rsvps_notify ON public.rsvps;
CREATE TRIGGER rsvps_notify
AFTER INSERT OR UPDATE OF attending, companions ON public.rsvps
FOR EACH ROW EXECUTE FUNCTION public.notify_rsvp();

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

  INSERT INTO public.weddings (owner_id, slug, bride_name, groom_name, wedding_date, published)
  VALUES (v_user, v_slug, trim(p_bride), trim(p_groom), p_date, true)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_own_wedding(text, text, text, date) FROM public;
GRANT EXECUTE ON FUNCTION public.create_own_wedding(text, text, text, date) TO authenticated;