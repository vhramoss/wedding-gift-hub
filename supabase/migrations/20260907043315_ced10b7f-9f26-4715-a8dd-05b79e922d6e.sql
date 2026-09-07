REVOKE EXECUTE ON FUNCTION public.wedding_payment_status(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.wedding_payment_status(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.disconnect_wedding_mp(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.disconnect_wedding_mp(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.save_wedding_mp_account(uuid, bigint, text, text, text, timestamptz, boolean, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_wedding_mp_account(uuid, bigint, text, text, text, timestamptz, boolean, uuid, text) TO authenticated, service_role;