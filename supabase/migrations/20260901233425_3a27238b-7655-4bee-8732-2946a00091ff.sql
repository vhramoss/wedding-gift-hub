REVOKE EXECUTE ON FUNCTION public.rsvp_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_open(uuid) TO authenticated, service_role;