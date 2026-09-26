CREATE OR REPLACE FUNCTION public.owns_wedding(_wedding_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.weddings w WHERE w.id = _wedding_id AND w.owner_id = auth.uid())
    OR public.is_wedding_coowner(_wedding_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin');
$$;