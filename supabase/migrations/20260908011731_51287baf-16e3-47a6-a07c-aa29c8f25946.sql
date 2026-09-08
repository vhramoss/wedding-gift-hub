drop function if exists public.public_order_status(uuid);

create or replace function public.public_order_status(p_order_id uuid)
returns table(
  id uuid,
  wedding_id uuid,
  gift_id uuid,
  user_id uuid,
  status text,
  payment_method text,
  installments integer,
  total_cents integer,
  commission_cents integer,
  pix_payload text,
  pix_qr_base64 text,
  gift_name text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select o.id, o.wedding_id, o.gift_id, o.user_id, o.status, o.payment_method,
         o.installments, o.total_cents, o.commission_cents,
         o.pix_payload, o.pix_qr_base64, g.name
  from public.orders o
  left join public.gifts g on g.id = o.gift_id
  where o.id = p_order_id;
$$;

grant execute on function public.public_order_status(uuid) to anon, authenticated;