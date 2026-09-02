ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS commission_percent numeric(5,2) NOT NULL DEFAULT 8.00;

ALTER TABLE public.wedding_invites ADD COLUMN IF NOT EXISTS wedding_id uuid REFERENCES public.weddings(id) ON DELETE CASCADE;

CREATE POLICY "owners manage own wedding invites"
ON public.wedding_invites FOR ALL TO authenticated
USING (wedding_id IS NOT NULL AND public.owns_wedding(wedding_id))
WITH CHECK (wedding_id IS NOT NULL AND public.owns_wedding(wedding_id) AND role = 'guest'::public.app_role);

CREATE POLICY "admins grant roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins revoke roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND role <> 'admin'::public.app_role);

CREATE POLICY "admins read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins read all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));