import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, LogOut, Menu, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/hooks/useSession";
import { useMyRoles } from "@/hooks/useRoles";
import { BRAND } from "@/lib/brand";

export function SiteHeader() {
  const { user, loading } = useSession();
  const { isOwner, isSuperAdmin } = useMyRoles(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const signedIn = !loading && !!user;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <Heart className="size-5 shrink-0 text-accent" />
          <span className="truncate font-display text-lg font-semibold tracking-wide sm:text-xl">
            {BRAND.name}
            <span className="hidden text-sm font-normal text-muted-foreground sm:inline">
              {" "}· {BRAND.tagline}
            </span>
          </span>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-2 md:flex">
          {signedIn ? (
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

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          {!signedIn ? (
            <Button asChild size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
          ) : (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-xs">
                <nav className="mt-8 flex flex-col gap-2">
                  {isSuperAdmin && (
                    <Button asChild variant="ghost" className="justify-start">
                      <Link to="/super-admin" onClick={() => setOpen(false)}>
                        <ShieldCheck className="size-4" /> Administrar casamentos
                      </Link>
                    </Button>
                  )}
                  {isOwner && (
                    <Button asChild variant="ghost" className="justify-start">
                      <Link to="/painel" onClick={() => setOpen(false)}>
                        Área dos noivos
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="ghost" className="justify-start">
                    <Link to="/meus-presentes" onClick={() => setOpen(false)}>
                      Meus presentes
                    </Link>
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={handleSignOut}>
                    <LogOut className="size-4" /> Sair
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}
