import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SessionState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
};

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    session: null,
    user: null,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, session, user: session?.user ?? null });
    });
    supabase.auth.getSession().then(({ data }) => {
      setState({ loading: false, session: data.session, user: data.session?.user ?? null });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}

export function useIsAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsAdmin(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return isAdmin;
}
