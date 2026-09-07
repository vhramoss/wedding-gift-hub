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
