DROP POLICY IF EXISTS "owners update own orders" ON public.orders;
REVOKE UPDATE ON public.orders FROM authenticated,anon;
GRANT UPDATE ON public.orders TO service_role;