CREATE TABLE public.wedding_payment_accounts (
  wedding_id uuid PRIMARY KEY REFERENCES public.weddings(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  mp_user_id bigint,
  access_token text NOT NULL,
  refresh_token text,
  public_key text,
  expires_at timestamptz,
  live_mode boolean NOT NULL DEFAULT true,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.wedding_payment_accounts TO service_role;

ALTER TABLE public.wedding_payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER wedding_payment_accounts_updated
BEFORE UPDATE ON public.wedding_payment_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS application_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_mp_user_id bigint;

-- Status da conexão (sem expor credenciais)
CREATE OR REPLACE FUNCTION public.wedding_payment_status(_wedding_id uuid)
RETURNS TABLE(connected boolean, mp_user_id bigint, live_mode boolean, connected_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.owns_wedding(_wedding_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT true, a.mp_user_id, a.live_mode, a.created_at
  FROM public.wedding_payment_accounts a
  WHERE a.wedding_id = _wedding_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::bigint, NULL::boolean, NULL::timestamptz;
  END IF;
END;
$$;

-- Salva/renova a conexão (servidor, protegido por segredo)
CREATE OR REPLACE FUNCTION public.save_wedding_mp_account(
  p_wedding_id uuid,
  p_mp_user_id bigint,
  p_access_token text,
  p_refresh_token text,
  p_public_key text,
  p_expires_at timestamptz,
  p_live_mode boolean,
  p_connected_by uuid,
  p_secret text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE expected text;
BEGIN
  SELECT value INTO expected FROM public.app_settings WHERE key = 'order_confirm_secret';
  IF expected IS NULL OR expected = '' OR p_secret IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Operação não autorizada.';
  END IF;
  INSERT INTO public.wedding_payment_accounts
    (wedding_id, mp_user_id, access_token, refresh_token, public_key, expires_at, live_mode, connected_by)
  VALUES
    (p_wedding_id, p_mp_user_id, p_access_token, nullif(p_refresh_token,''), nullif(p_public_key,''),
     p_expires_at, coalesce(p_live_mode, true), p_connected_by)
  ON CONFLICT (wedding_id) DO UPDATE SET
    mp_user_id = excluded.mp_user_id,
    access_token = excluded.access_token,
    refresh_token = coalesce(excluded.refresh_token, public.wedding_payment_accounts.refresh_token),
    public_key = coalesce(excluded.public_key, public.wedding_payment_accounts.public_key),
    expires_at = excluded.expires_at,
    live_mode = excluded.live_mode,
    connected_by = coalesce(excluded.connected_by, public.wedding_payment_accounts.connected_by);
END;
$$;

-- Lê credenciais (servidor, protegido por segredo)
CREATE OR REPLACE FUNCTION public.get_wedding_mp_credentials(p_wedding_id uuid, p_secret text)
RETURNS TABLE(mp_user_id bigint, access_token text, refresh_token text, expires_at timestamptz, live_mode boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE expected text;
BEGIN
  SELECT value INTO expected FROM public.app_settings WHERE key = 'order_confirm_secret';
  IF expected IS NULL OR expected = '' OR p_secret IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Operação não autorizada.';
  END IF;
  RETURN QUERY
  SELECT a.mp_user_id, a.access_token, a.refresh_token, a.expires_at, a.live_mode
  FROM public.wedding_payment_accounts a
  WHERE a.wedding_id = p_wedding_id;
END;
$$;

-- Registra a comissão retida no pedido (servidor, protegido por segredo)
CREATE OR REPLACE FUNCTION public.record_order_split(
  p_order_id uuid,
  p_application_fee_cents integer,
  p_seller_mp_user_id bigint,
  p_secret text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE expected text;
BEGIN
  SELECT value INTO expected FROM public.app_settings WHERE key = 'order_confirm_secret';
  IF expected IS NULL OR expected = '' OR p_secret IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Operação não autorizada.';
  END IF;
  UPDATE public.orders
     SET application_fee_cents = greatest(coalesce(p_application_fee_cents, 0), 0),
         seller_mp_user_id = p_seller_mp_user_id,
         commission_cents = greatest(coalesce(p_application_fee_cents, 0), 0)
   WHERE id = p_order_id;
END;
$$;

-- Desconectar conta
CREATE OR REPLACE FUNCTION public.disconnect_wedding_mp(_wedding_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.owns_wedding(_wedding_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  DELETE FROM public.wedding_payment_accounts WHERE wedding_id = _wedding_id;
END;
$$;