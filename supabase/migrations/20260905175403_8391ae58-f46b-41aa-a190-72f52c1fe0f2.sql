-- Mercado Pago: campos de pagamento real em orders
-- O dono do site e o intermediador (Mercado Pago). O dinheiro cai na conta
-- do dono; o repasse aos noivos (líquido de comissão) é manual.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mp_payment_id bigint;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_payload text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_qr_base64 text;

COMMENT ON COLUMN public.orders.mp_payment_id IS 'ID do pagamento no Mercado Pago';
COMMENT ON COLUMN public.orders.provider IS 'manual | mercadopago';
COMMENT ON COLUMN public.orders.pix_payload IS 'Código Pix copia e cola gerado pelo Mercado Pago';
COMMENT ON COLUMN public.orders.pix_qr_base64 IS 'QR Code Pix (base64) gerado pelo Mercado Pago';

-- Comissão registrada no momento do pagamento para o super-admin acompanhar.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commission_cents integer NOT NULL DEFAULT 0;