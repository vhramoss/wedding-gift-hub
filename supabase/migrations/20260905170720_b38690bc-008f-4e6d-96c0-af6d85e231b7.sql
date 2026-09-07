ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS theme_template text NOT NULL DEFAULT 'classico',
  ADD COLUMN IF NOT EXISTS theme_primary text,
  ADD COLUMN IF NOT EXISTS theme_accent text,
  ADD COLUMN IF NOT EXISTS theme_background text,
  ADD COLUMN IF NOT EXISTS theme_font_display text,
  ADD COLUMN IF NOT EXISTS theme_font_body text;

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  description text,
  logo_url text,
  phone text,
  whatsapp text,
  website_url text,
  city text,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read active vendors" ON public.vendors
  FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage vendors" ON public.vendors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.vendors TO authenticated;

CREATE TRIGGER vendors_set_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.wedding_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text,
  amount_cents integer NOT NULL DEFAULT 0,
  paid_cents integer NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'planned',
  pay_from_gifts boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_expenses TO authenticated;
GRANT ALL ON public.wedding_expenses TO service_role;
ALTER TABLE public.wedding_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own expenses" ON public.wedding_expenses
  FOR ALL TO authenticated
  USING (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.owns_wedding(wedding_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER wedding_expenses_set_updated_at BEFORE UPDATE ON public.wedding_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS wedding_expenses_wedding_idx ON public.wedding_expenses(wedding_id);