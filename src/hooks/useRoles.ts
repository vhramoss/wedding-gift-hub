import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "owner" | "guest";

/** Perfis do usuário logado: admin (super admin), owner (noivos) e guest (convidado). */
export function useMyRoles(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["my-roles", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const roles = query.data ?? [];
  return {
    roles,
    isLoading: query.isLoading,
    isSuperAdmin: roles.includes("admin"),
    isOwner: roles.includes("owner") || roles.includes("admin"),
  };
}
