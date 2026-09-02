CREATE OR REPLACE FUNCTION public.owns_wedding(_wedding_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.weddings w
    WHERE w.id = _wedding_id AND w.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_wedding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_wedding(uuid) TO authenticated;

-- weddings: owner can manage own wedding
CREATE POLICY "owners manage own wedding" ON public.weddings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- gifts
CREATE POLICY "owners manage own gifts" ON public.gifts
  FOR ALL TO authenticated
  USING (public.owns_wedding(wedding_id))
  WITH CHECK (public.owns_wedding(wedding_id));

-- people
CREATE POLICY "owners manage own people" ON public.wedding_people
  FOR ALL TO authenticated
  USING (public.owns_wedding(wedding_id))
  WITH CHECK (public.owns_wedding(wedding_id));

-- messages moderation
CREATE POLICY "owners read own messages" ON public.wedding_messages
  FOR SELECT TO authenticated
  USING (public.owns_wedding(wedding_id));
CREATE POLICY "owners moderate own messages" ON public.wedding_messages
  FOR UPDATE TO authenticated
  USING (public.owns_wedding(wedding_id))
  WITH CHECK (public.owns_wedding(wedding_id));
CREATE POLICY "owners delete own messages" ON public.wedding_messages
  FOR DELETE TO authenticated
  USING (public.owns_wedding(wedding_id));

-- rsvps / orders visibility for owners
CREATE POLICY "owners read own rsvps" ON public.rsvps
  FOR SELECT TO authenticated
  USING (public.owns_wedding(wedding_id));
CREATE POLICY "owners read own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.owns_wedding(wedding_id));
CREATE POLICY "owners update own orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.owns_wedding(wedding_id))
  WITH CHECK (public.owns_wedding(wedding_id));

-- gallery
CREATE TABLE public.wedding_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wedding_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_photos TO authenticated;
GRANT ALL ON public.wedding_photos TO service_role;

ALTER TABLE public.wedding_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon photos readable" ON public.wedding_photos
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = wedding_id AND w.published));
CREATE POLICY "auth photos readable" ON public.wedding_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = wedding_id AND w.published)
    OR public.owns_wedding(wedding_id)
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "owners manage own photos" ON public.wedding_photos
  FOR ALL TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER wedding_photos_updated
  BEFORE UPDATE ON public.wedding_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();