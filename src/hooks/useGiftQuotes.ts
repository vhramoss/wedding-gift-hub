import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type GiftQuoteItem = { giftId: string; shares: number };

export function giftQuoteKey(giftId: string, shares: number) {
  return `${giftId}:${shares}`;
}

export function useGiftQuotes(items: GiftQuoteItem[]) {
  const quoteKey = items.map((item) => `${item.giftId}:${item.shares}`).join("|");

  return useQuery({
    queryKey: ["public-gift-quotes", quoteKey],
    enabled: items.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_gift_quote", {
        p_items: items,
      });
      if (error) throw error;
      return new Map(
        (data ?? []).map((quote) => [giftQuoteKey(quote.gift_id, quote.shares), quote]),
      );
    },
  });
}