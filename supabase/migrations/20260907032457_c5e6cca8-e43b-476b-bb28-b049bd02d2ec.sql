create or replace function public.create_gift_order(p_gift_id uuid, p_method text, p_installments integer, p_message text)
returns table(order_id uuid, total_cents integer, installments integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  g record;
  inst int;
  ch record;
  v_user uuid := auth.uid();
  v_name text;
  v_cpf text;
  v_order uuid;
begin
  if v_user is null then
    raise exception 'Faça login para comprar um presente.';
  end if;
  if p_method not in ('pix','debit','credit') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select id, wedding_id, name, price_cents, quantity, purchased_count, active
    into g from public.gifts where id = p_gift_id for update;
  if not found or coalesce(g.active, false) = false then
    raise exception 'Presente indisponível.';
  end if;
  if g.quantity > 0 and g.purchased_count >= g.quantity then
    raise exception 'Este presente já foi todo comprado.';
  end if;

  if p_method = 'credit' then
    inst := greatest(1, least(12, p_installments));
  else
    inst := 1;
  end if;

  select fee_cents, total_cents, installment_cents into ch
    from public.compute_charge(g.price_cents, p_method, inst);

  select full_name, cpf into v_name, v_cpf from public.profiles where id = v_user;

  insert into public.orders
    (wedding_id, gift_id, user_id, guest_name, guest_cpf, payment_method,
     installments, amount_cents, fee_cents, total_cents, message, status)
  values
    (g.wedding_id, g.id, v_user, coalesce(v_name, ''), v_cpf, p_method,
     inst, g.price_cents, ch.fee_cents, ch.total_cents,
     nullif(trim(coalesce(p_message, '')), ''), 'pending')
  returning id into v_order;

  return query select v_order, ch.total_cents, inst;
end;
$$;