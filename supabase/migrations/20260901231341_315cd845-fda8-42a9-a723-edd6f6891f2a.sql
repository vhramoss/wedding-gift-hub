ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS story_how_we_met text,
  ADD COLUMN IF NOT EXISTS story_proposal text,
  ADD COLUMN IF NOT EXISTS story_text text,
  ADD COLUMN IF NOT EXISTS ceremony_venue text,
  ADD COLUMN IF NOT EXISTS ceremony_address text,
  ADD COLUMN IF NOT EXISTS ceremony_time text,
  ADD COLUMN IF NOT EXISTS ceremony_map_url text,
  ADD COLUMN IF NOT EXISTS party_venue text,
  ADD COLUMN IF NOT EXISTS party_address text,
  ADD COLUMN IF NOT EXISTS party_time text,
  ADD COLUMN IF NOT EXISTS party_map_url text,
  ADD COLUMN IF NOT EXISTS party_image_url text,
  ADD COLUMN IF NOT EXISTS dress_code text,
  ADD COLUMN IF NOT EXISTS tips text,
  ADD COLUMN IF NOT EXISTS hashtag text;

CREATE TABLE IF NOT EXISTS public.wedding_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'padrinho' CHECK (kind IN ('padrinho','madrinha','fornecedor')),
  name text NOT NULL,
  role text,
  description text,
  photo_url text,
  website_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wedding_people TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_people TO authenticated;
GRANT ALL ON public.wedding_people TO service_role;

ALTER TABLE public.wedding_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon people readable" ON public.wedding_people FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = wedding_id AND w.published));
CREATE POLICY "auth people readable" ON public.wedding_people FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = wedding_id AND (w.published OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "admins manage people" ON public.wedding_people FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_wedding_people_updated_at BEFORE UPDATE ON public.wedding_people
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.wedding_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wedding_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_messages TO authenticated;
GRANT ALL ON public.wedding_messages TO service_role;

ALTER TABLE public.wedding_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon messages readable" ON public.wedding_messages FOR SELECT TO anon
  USING (approved AND EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = wedding_id AND w.published));
CREATE POLICY "auth messages readable" ON public.wedding_messages FOR SELECT TO authenticated
  USING (approved OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "guests create messages" ON public.wedding_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage messages" ON public.wedding_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete messages" ON public.wedding_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_wedding_messages_updated_at BEFORE UPDATE ON public.wedding_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();