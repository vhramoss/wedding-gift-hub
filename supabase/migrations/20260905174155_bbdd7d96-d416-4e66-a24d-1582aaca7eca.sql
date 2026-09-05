ALTER TABLE public.wedding_expenses
  ADD COLUMN IF NOT EXISTS installments integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS installments_paid integer NOT NULL DEFAULT 0;

ALTER TABLE public.wedding_expenses
  ADD CONSTRAINT wedding_expenses_installments_check CHECK (installments >= 1),
  ADD CONSTRAINT wedding_expenses_installments_paid_check CHECK (installments_paid >= 0 AND installments_paid <= installments);