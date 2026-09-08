-- 0. util
create or replace function public.norm_txt(t text)
returns text language sql immutable set search_path = public as $$
  select lower(translate(coalesce(t,''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
$$;

-- 1. pedidos de convidados sem conta
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists guest_email text;
alter table public.orders add column if not exists guest_phone text;

-- 2. leitura pública das páginas do casamento
create policy "anon gifts readable" on public.gifts for select to anon
  using (exists (select 1 from public.weddings w
    where w.id = gifts.wedding_id and w.published and w.approval_status = 'approved'));
grant select on public.gifts to anon;

create policy "anon photos readable" on public.wedding_photos for select to anon
  using (exists (select 1 from public.weddings w
    where w.id = wedding_photos.wedding_id and w.published and w.approval_status = 'approved'));
grant select on public.wedding_photos to anon;

create policy "anon people readable" on public.wedding_people for select to anon
  using (exists (select 1 from public.weddings w
    where w.id = wedding_people.wedding_id and w.published and w.approval_status = 'approved'));
grant select on public.wedding_people to anon;

create policy "anon announcements readable" on public.wedding_announcements for select to anon
  using (exists (select 1 from public.weddings w
    where w.id = wedding_announcements.wedding_id and w.published and w.approval_status = 'approved'));
grant select on public.wedding_announcements to anon;

create policy "anon messages readable" on public.wedding_messages for select to anon
  using (approved and exists (select 1 from public.weddings w
    where w.id = wedding_messages.wedding_id and w.published and w.approval_status = 'approved'));
grant select on public.wedding_messages to anon;

grant select on public.vendors to anon;

-- 3. lista de convidados
create table public.wedding_guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  name_norm text generated always as (public.norm_txt(name)) stored,
  group_label text,
  phone text,
  email text,
  max_companions integer not null default 0,
  attending boolean,
  companions integer not null default 0,
  attending_ceremony boolean,
  attending_party boolean,
  dietary_notes text,
  message text,
  responded_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index wedding_guests_unique_name on public.wedding_guests (wedding_id, name_norm);
create index wedding_guests_wedding on public.wedding_guests (wedding_id);

grant select, insert, update, delete on public.wedding_guests to authenticated;
grant all on public.wedding_guests to service_role;

alter table public.wedding_guests enable row level security;

create policy "owners manage guests" on public.wedding_guests for all to authenticated
  using (public.owns_wedding(wedding_id) or public.has_role(auth.uid(), 'admin'))
  with check (public.owns_wedding(wedding_id) or public.has_role(auth.uid(), 'admin'));

create trigger wedding_guests_updated before update on public.wedding_guests
  for each row execute function public.set_updated_at();

-- 4. busca pública pelo nome
create or replace function public.search_wedding_guests(p_wedding_id uuid, p_query text)
returns table(id uuid, name text, group_label text, max_companions integer,
              attending boolean, companions integer, attending_ceremony boolean,
              attending_party boolean, dietary_notes text)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.group_label, g.max_companions, g.attending, g.companions,
         g.attending_ceremony, g.attending_party, g.dietary_notes
  from public.wedding_guests g
  join public.weddings w on w.id = g.wedding_id
  where g.wedding_id = p_wedding_id
    and w.published and w.approval_status = 'approved'
    and length(coalesce(trim(p_query), '')) >= 3
    and g.name_norm like '%' || public.norm_txt(trim(p_query)) || '%'
  order by g.name
  limit 10
$$;
grant execute on function public.search_wedding_guests(uuid, text) to anon, authenticated;

create or replace function public.respond_wedding_guest(
  p_guest_id uuid, p_attending boolean, p_companions integer default 0,
  p_ceremony boolean default true, p_party boolean default true,
  p_dietary text default null, p_message text default null)
returns void language plpgsql security definer set search_path = public as $$
declare g record; w record;
begin
  select * into g from public.wedding_guests where id = p_guest_id for update;
  if not found then raise exception 'Convidado não encontrado na lista.'; end if;
  select * into w from public.weddings where id = g.wedding_id;
  if not (w.published and w.approval_status = 'approved') then
    raise exception 'Esta lista ainda não está liberada.';
  end if;
  if not public.rsvp_open(g.wedding_id) then
    raise exception 'O prazo para confirmar presença já encerrou.';
  end if;

  update public.wedding_guests set
    attending = p_attending,
    companions = case when p_attending then greatest(0, least(coalesce(p_companions,0), g.max_companions)) else 0 end,
    attending_ceremony = case when p_attending then coalesce(p_ceremony, true) else false end,
    attending_party = case when p_attending then coalesce(p_party, true) else false end,
    dietary_notes = case when p_attending then nullif(trim(coalesce(p_dietary,'')), '') else null end,
    message = nullif(trim(coalesce(p_message,'')), ''),
    responded_at = now()
  where id = p_guest_id;

  insert into public.wedding_notifications (wedding_id, kind, title, body)
  values (g.wedding_id, 'rsvp',
    case when p_attending then 'Nova confirmação de presença' else 'Convidado não poderá ir' end,
    g.name || case when p_attending
      then ' confirmou presença (' || greatest(0, least(coalesce(p_companions,0), g.max_companions)) || ' acompanhante(s))'
      else ' informou que não poderá comparecer' end);
end;
$$;
grant execute on function public.respond_wedding_guest(uuid, boolean, integer, boolean, boolean, text, text) to anon, authenticated;

-- 5. presente sem conta
create or replace function public.create_public_gift_order(
  p_gift_id uuid, p_method text, p_installments integer, p_message text,
  p_shares integer, p_guest_name text, p_guest_email text,
  p_guest_phone text default null, p_guest_cpf text default null)
returns table(order_id uuid, total_cents integer, installments integer)
language plpgsql security definer set search_path = public as $$
declare
  g record; w record; ch record; inst int; v_shares int; v_available int;
  v_share_price int; v_amount int; v_base int; v_comm int := 0; v_order uuid;
begin
  if coalesce(trim(p_guest_name), '') = '' or coalesce(trim(p_guest_email), '') = '' then
    raise exception 'Informe seu nome e e-mail.';
  end if;
  if p_method not in ('pix','debit','credit') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select id, wedding_id, name, price_cents, quantity, purchased_count, active, shares_total
    into g from public.gifts where id = p_gift_id for update;
  if not found or coalesce(g.active, false) = false then
    raise exception 'Presente indisponível.';
  end if;

  select approval_status, commission_percent, commission_paid_by, published
    into w from public.weddings where id = g.wedding_id;
  if w.approval_status is distinct from 'approved' or not w.published then
    raise exception 'Esta lista de presentes ainda não está liberada.';
  end if;

  if coalesce(g.shares_total, 1) > 1 then
    v_available := g.shares_total - coalesce(g.purchased_count, 0);
    if v_available <= 0 then raise exception 'Todas as cotas já foram compradas.'; end if;
    v_shares := greatest(1, least(coalesce(p_shares, 1), v_available));
    v_share_price := ceil(g.price_cents::numeric / g.shares_total)::int;
    v_amount := v_share_price * v_shares;
  else
    if g.quantity > 0 and g.purchased_count >= g.quantity then
      raise exception 'Este presente já foi todo comprado.';
    end if;
    v_shares := 1;
    v_amount := g.price_cents;
  end if;

  if p_method = 'credit' then inst := greatest(1, least(12, p_installments)); else inst := 1; end if;

  v_comm := greatest(round(v_amount * coalesce(w.commission_percent, 0) / 100)::int, 0);
  if coalesce(w.commission_paid_by, 'couple') = 'guest' then
    v_base := v_amount + v_comm;
  else
    v_base := v_amount;
  end if;

  select c.fee_cents, c.total_cents, c.installment_cents into ch
    from public.compute_charge(v_base, p_method, inst) c;

  insert into public.orders
    (wedding_id, gift_id, user_id, guest_name, guest_cpf, guest_email, guest_phone,
     payment_method, installments, amount_cents, fee_cents, total_cents, message,
     status, shares, commission_cents)
  values
    (g.wedding_id, g.id, null, trim(p_guest_name), nullif(trim(coalesce(p_guest_cpf,'')), ''),
     lower(trim(p_guest_email)), nullif(trim(coalesce(p_guest_phone,'')), ''),
     p_method, inst, v_amount, ch.total_cents - v_amount, ch.total_cents,
     nullif(trim(coalesce(p_message, '')), ''), 'pending', v_shares, v_comm)
  returning id into v_order;

  return query select v_order, ch.total_cents, inst;
end;
$$;
grant execute on function public.create_public_gift_order(uuid, text, integer, text, integer, text, text, text, text) to anon, authenticated;

-- pix para pedidos de visitante
create or replace function public.record_public_pix_payment(
  p_order_id uuid, p_mp_payment_id bigint, p_payload text, p_qr_base64 text)
returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.user_id is not null then raise exception 'Pedido não é de visitante.'; end if;
  if o.payment_method <> 'pix' or o.status <> 'pending' then
    raise exception 'Pedido não está aguardando Pix.';
  end if;
  update public.orders set mp_payment_id = p_mp_payment_id, provider = 'mercadopago',
    pix_payload = p_payload, pix_qr_base64 = p_qr_base64
  where id = p_order_id;
end;
$$;
grant execute on function public.record_public_pix_payment(uuid, bigint, text, text) to anon, authenticated;

create or replace function public.public_order_status(p_order_id uuid)
returns table(id uuid, status text, payment_method text, total_cents integer,
              pix_payload text, pix_qr_base64 text, gift_name text)
language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.payment_method, o.total_cents, o.pix_payload, o.pix_qr_base64, g.name
  from public.orders o left join public.gifts g on g.id = o.gift_id
  where o.id = p_order_id
$$;
grant execute on function public.public_order_status(uuid) to anon, authenticated;