import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** O casamento do site (modelo de um casal só). */
export function useMainWedding() {
  return useQuery({
    queryKey: ["main-wedding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** O casamento que pertence ao usuário logado (noivos). */
export function useMyWedding(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-wedding", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * O casamento certo para a pessoa logada: o dela (noivos) ou, para convidados,
 * aquele em que já confirmou presença/presenteou. Sem vínculo, não redireciona.
 */
export function useHomeWedding(userId: string | undefined) {
  return useQuery({
    queryKey: ["home-wedding", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const own = await supabase
        .from("weddings")
        .select("*")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (own.error) throw own.error;
      if (own.data) return own.data;

      const rsvp = await supabase
        .from("rsvps")
        .select("wedding_id")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rsvp.error) throw rsvp.error;

      let weddingId = rsvp.data?.wedding_id ?? null;
      if (!weddingId) {
        const order = await supabase
          .from("orders")
          .select("wedding_id")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (order.error) throw order.error;
        weddingId = order.data?.wedding_id ?? null;
      }
      if (!weddingId) return null;

      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .eq("id", weddingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
