REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_gift_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY "public weddings readable" ON public.weddings;
CREATE POLICY "anon weddings readable" ON public.weddings FOR SELECT TO anon USING (published);
CREATE POLICY "auth weddings readable" ON public.weddings FOR SELECT TO authenticated
  USING (published OR public.has_role(auth.uid(), 'admin'));

DROP POLICY "public gifts readable" ON public.gifts;
CREATE POLICY "anon gifts readable" ON public.gifts FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = wedding_id AND w.published));
CREATE POLICY "auth gifts readable" ON public.gifts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = wedding_id AND w.published)
         OR public.has_role(auth.uid(), 'admin'));