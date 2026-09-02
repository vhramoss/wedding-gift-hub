ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS rsvp_deadline date;

CREATE TABLE public.wedding_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_announcements TO authenticated;
GRANT ALL ON public.wedding_announcements TO service_role;

ALTER TABLE public.wedding_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read announcements" ON public.wedding_announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "owners manage announcements" ON public.wedding_announcements
  FOR ALL TO authenticated USING (public.owns_wedding(wedding_id)) WITH CHECK (public.owns_wedding(wedding_id));

CREATE TRIGGER wedding_announcements_updated BEFORE UPDATE ON public.wedding_announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Conteúdo apenas para convidados autenticados
DROP POLICY IF EXISTS "anon weddings readable" ON public.weddings;
DROP POLICY IF EXISTS "anon gifts readable" ON public.gifts;
DROP POLICY IF EXISTS "anon people readable" ON public.wedding_people;
DROP POLICY IF EXISTS "anon photos readable" ON public.wedding_photos;
DROP POLICY IF EXISTS "anon messages readable" ON public.wedding_messages;

-- Prazo para (des)confirmar presença
CREATE OR REPLACE FUNCTION public.rsvp_open(_wedding_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT w.rsvp_deadline IS NULL OR w.rsvp_deadline >= CURRENT_DATE
       FROM public.weddings w WHERE w.id = _wedding_id),
    false);
$$;
REVOKE EXECUTE ON FUNCTION public.rsvp_open(uuid) FROM anon;

DROP POLICY IF EXISTS "guests update own rsvp" ON public.rsvps;
CREATE POLICY "guests update own rsvp" ON public.rsvps
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.rsvp_open(wedding_id))
  WITH CHECK (user_id = auth.uid() AND public.rsvp_open(wedding_id));

DROP POLICY IF EXISTS "guests write own rsvp" ON public.rsvps;
CREATE POLICY "guests write own rsvp" ON public.rsvps
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.rsvp_open(wedding_id));