import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";

export function SiteHeader() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Heart className="size-5 text-accent" />
          <span className="font-display text-xl font-semibold tracking-wide">
            Nós Dois · Lista de Presentes
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {!loading && user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/painel">Área dos noivos</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/meus-presentes">Meus presentes</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
