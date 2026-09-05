-- Segurança de pagamentos:
-- o navegador não cria nem altera pedidos financeiros diretamente.
-- Pedidos e mudanças de status passam pelos Server Functions/Webhook usando service_role.

DROP POLICY IF EXISTS "guests create own orders" ON public.orders;
DROP POLICY IF EXISTS "guests update own pending orders" ON public.orders;
DROP POLICY IF EXISTS "owners update own orders" ON public.orders;