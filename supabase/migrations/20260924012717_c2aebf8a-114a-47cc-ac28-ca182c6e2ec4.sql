ALTER TABLE public.weddings ADD COLUMN hero_title text;

COMMENT ON COLUMN public.weddings.hero_title IS 'Título personalizado exibido na capa; quando vazio, usa os nomes do cadastro.';