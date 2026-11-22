REVOKE ALL ON FUNCTION public.get_wedding_mp_credentials(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_wedding_mp_credentials(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid,bigint,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.record_order_split(uuid,integer,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_split(uuid,integer,bigint,text) TO service_role;
REVOKE ALL ON FUNCTION public.save_wedding_mp_account(uuid,bigint,text,text,text,timestamptz,boolean,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_wedding_mp_account(uuid,bigint,text,text,text,timestamptz,boolean,uuid,text) TO service_role;