ALTER TABLE public.wedding_guests
  ADD COLUMN IF NOT EXISTS companion_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS companions_confirmed text[] NOT NULL DEFAULT '{}';

DROP FUNCTION IF EXISTS public.my_wedding_guest(uuid);
CREATE FUNCTION public.my_wedding_guest(_wedding_id uuid)
RETURNS TABLE(id uuid, name text, group_label text, max_companions integer, attending boolean, companions integer,
  attending_ceremony boolean, attending_party boolean, dietary_notes text, companion_names text[], companions_confirmed text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name, g.group_label, g.max_companions, g.attending, g.companions, g.attending_ceremony, g.attending_party,
         g.dietary_notes, g.companion_names, g.companions_confirmed
  FROM public.wedding_guests g WHERE g.wedding_id = _wedding_id AND g.user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.my_wedding_guest(uuid) TO authenticated;

-- Confirma dependentes nominais: só os nomes pré-cadastrados pelos noivos
CREATE OR REPLACE FUNCTION public.confirm_guest_companions(p_guest_id uuid, p_names text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.wedding_guests%ROWTYPE; v text[];
BEGIN
  SELECT * INTO g FROM public.wedding_guests WHERE id = p_guest_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Convidado não encontrado.'; END IF;
  IF g.user_id IS DISTINCT FROM auth.uid() AND NOT public.owns_wedding(g.wedding_id) THEN
    RAISE EXCEPTION 'Somente o próprio convidado pode confirmar os dependentes.';
  END IF;
  SELECT coalesce(array_agg(n), '{}') INTO v FROM unnest(g.companion_names) n
   WHERE g.attending IS TRUE AND n = ANY(coalesce(p_names,'{}'));
  UPDATE public.wedding_guests SET companions_confirmed = v, companions = cardinality(v) WHERE id = g.id;
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_guest_companions(uuid, text[]) TO authenticated;