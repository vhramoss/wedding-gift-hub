REVOKE ALL ON FUNCTION public.public_order_status(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_order_status(uuid) TO service_role;