ALTER TABLE public.gifts DROP CONSTRAINT gifts_quantity_check;
ALTER TABLE public.gifts ADD CONSTRAINT gifts_quantity_check CHECK (quantity >= 0);
COMMENT ON COLUMN public.gifts.quantity IS '0 means unlimited contributions for gifts without shares; positive quantities retain stock limits. shares_total > 1 always limits shares.';