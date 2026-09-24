REVOKE EXECUTE ON FUNCTION public.seed_default_fee_tiers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_planner_cents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wedding_fee_schedule(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_invited_guest(uuid,text,text) FROM PUBLIC, anon;