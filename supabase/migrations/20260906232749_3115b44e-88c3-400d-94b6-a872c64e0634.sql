DROP POLICY IF EXISTS "guests create own orders" ON public.orders;
DROP POLICY IF EXISTS "guests update own pending orders" ON public.orders;
REVOKE INSERT, UPDATE ON public.orders FROM authenticated;
GRANT ALL ON public.orders TO service_role;