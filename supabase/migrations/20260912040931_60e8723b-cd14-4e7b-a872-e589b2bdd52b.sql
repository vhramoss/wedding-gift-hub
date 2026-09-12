CREATE OR REPLACE FUNCTION public.public_gift_quote(p_items jsonb)
RETURNS TABLE(gift_id uuid, shares integer, amount_cents integer, service_cents integer, total_cents integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  g record;
  w record;
  requested_shares integer;
  available_shares integer;
  base_amount integer;
  commission_amount integer;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um presente.';
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Quantidade de presentes inválida.';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      requested_shares := GREATEST(1, COALESCE((item->>'shares')::integer, 1));
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Quantidade de cotas inválida.';
    END;

    SELECT id, wedding_id, price_cents, quantity, purchased_count, active, shares_total
      INTO g
      FROM public.gifts
      WHERE id = (item->>'giftId')::uuid;

    IF NOT FOUND OR COALESCE(g.active, false) = false THEN
      RAISE EXCEPTION 'Presente indisponível.';
    END IF;

    SELECT published, approval_status, commission_paid_by
      INTO w
      FROM public.weddings
      WHERE id = g.wedding_id;

    IF NOT FOUND OR NOT w.published OR w.approval_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Esta lista de presentes ainda não está liberada.';
    END IF;

    IF COALESCE(g.shares_total, 1) > 1 THEN
      available_shares := GREATEST(0, g.shares_total - COALESCE(g.purchased_count, 0));
      IF requested_shares > available_shares THEN
        RAISE EXCEPTION 'Quantidade de cotas indisponível.';
      END IF;
      base_amount := CEIL(g.price_cents::numeric / g.shares_total)::integer * requested_shares;
    ELSE
      IF requested_shares <> 1 OR (g.quantity > 0 AND g.purchased_count >= g.quantity) THEN
        RAISE EXCEPTION 'Presente indisponível.';
      END IF;
      base_amount := g.price_cents;
    END IF;

    commission_amount := GREATEST(
      ROUND(base_amount * public.commission_percent_for(g.wedding_id, base_amount) / 100)::integer,
      0
    );

    gift_id := g.id;
    shares := requested_shares;
    amount_cents := base_amount;
    service_cents := CASE WHEN COALESCE(w.commission_paid_by, 'couple') = 'guest' THEN commission_amount ELSE 0 END;
    total_cents := amount_cents + service_cents;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.public_gift_quote(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_gift_quote(jsonb) TO anon, authenticated, service_role;