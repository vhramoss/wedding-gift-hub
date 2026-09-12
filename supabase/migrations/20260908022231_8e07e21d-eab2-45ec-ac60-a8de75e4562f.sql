UPDATE public.weddings
SET published = true,
    updated_at = now()
WHERE slug = 'beatriz-e-pedro'
  AND approval_status = 'approved';