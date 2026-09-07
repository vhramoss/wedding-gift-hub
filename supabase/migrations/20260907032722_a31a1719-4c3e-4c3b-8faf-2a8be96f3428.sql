create or replace function public.compute_charge(p_amount_cents integer, p_method text, p_installments integer)
returns table(fee_cents integer, total_cents integer, installment_cents integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  n int;
  i numeric;
  amt numeric := p_amount_cents;
  factor numeric;
  inst numeric;
  total numeric;
begin
  if p_method = 'credit' then
    n := greatest(1, least(12, p_installments));
  else
    n := 1;
  end if;
  if p_method <> 'credit' or n <= 1 then
    i := 0;
  elsif n <= 6 then
    i := 0.0199;
  else
    i := 0.0249;
  end if;
  if i = 0 then
    fee_cents := 0;
    total_cents := p_amount_cents;
    installment_cents := round(amt / n)::int;
  else
    factor := (i * power(1 + i, n)) / (power(1 + i, n) - 1);
    inst := round(amt * factor);
    total := inst * n;
    total_cents := total::int;
    fee_cents := (total - amt)::int;
    installment_cents := inst::int;
  end if;
  return next;
end;
$$;