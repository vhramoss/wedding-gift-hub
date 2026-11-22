CREATE OR REPLACE FUNCTION public.my_invited_weddings() RETURNS TABLE(wedding_id uuid, slug text, bride_name text, groom_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT DISTINCT w.id,w.slug,w.bride_name,w.groom_name FROM public.wedding_guests g JOIN public.wedding_public w ON w.id=g.wedding_id WHERE auth.uid() IS NOT NULL AND g.user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.wedding_invites i WHERE i.guest_id=g.id AND i.wedding_id=g.wedding_id AND i.used_by=auth.uid() AND i.role='guest') ORDER BY w.slug; $$;
REVOKE ALL ON FUNCTION public.my_invited_weddings() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.my_invited_weddings() TO authenticated,service_role;
DROP POLICY IF EXISTS "guests write own rsvp" ON public.rsvps;
DROP POLICY IF EXISTS "guests update own rsvp" ON public.rsvps;
DROP POLICY IF EXISTS "guests create messages" ON public.wedding_messages;
REVOKE ALL ON FUNCTION public.record_pix_payment(uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_public_pix_payment(uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_pix_payment(uuid,bigint,text,text),public.record_public_pix_payment(uuid,bigint,text,text) TO service_role;