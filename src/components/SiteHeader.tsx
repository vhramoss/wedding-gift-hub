import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useMyRoles } from "@/hooks/useRoles";
import { BRAND } from "@/lib/brand";

export function SiteHeader() {
  const { user, loading } = useSession();
  const { isOwner, isSuperAdmin } = useMyRoles(user?.id);
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
            {BRAND.name}
            <span className="hidden text-sm font-normal text-muted-foreground sm:inline">
              {" "}· {BRAND.tagline}
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {!loading && user ? (
            <>
              {isSuperAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/super-admin">
                    <ShieldCheck className="size-4" />
                    Administrar casamentos
                  </Link>
                </Button>
              )}
              {isOwner && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/painel">Área dos noivos</Link>
                </Button>
              )}
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
