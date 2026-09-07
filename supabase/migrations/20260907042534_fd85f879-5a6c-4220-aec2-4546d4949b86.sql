create or replace function public.wedding_donors(_wedding_id uuid)
returns table(
  order_id uuid,
  gift_name text,
  guest_name text,
  guest_email text,
  guest_phone text,
  amount_cents integer,
  total_cents integer,
  payment_method text,
  installments integer,
  status text,
  message text,
  created_at timestamptz,
  paid_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id,
         g.name,
         coalesce(nullif(trim(o.guest_name), ''), p.full_name, 'Convidado'),
         u.email::text,
         p.phone,
         o.amount_cents,
         o.total_cents,
         o.payment_method,
         o.installments,
         o.status,
         o.message,
         o.created_at,
         o.paid_at
  from public.orders o
  left join public.gifts g on g.id = o.gift_id
  left join public.profiles p on p.id = o.user_id
  left join auth.users u on u.id = o.user_id
  where o.wedding_id = _wedding_id
    and (public.owns_wedding(_wedding_id) or public.has_role(auth.uid(), 'admin'))
  order by o.created_at desc;
$$;

revoke all on function public.wedding_donors(uuid) from public, anon;
grant execute on function public.wedding_donors(uuid) to authenticated;