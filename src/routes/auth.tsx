import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/brand";
import { loginDestination } from "@/lib/login-destination";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Entrar · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Acesse com e-mail e senha para confirmar presença e escolher o presente dos noivos.",
      },
      { property: "og:title", content: `Entrar · ${BRAND.name}` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Login de convidados e noivos. Novas contas somente por convite.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  async function goAfterLogin() {
    const { data, error } = await supabase.rpc("my_invited_weddings");
    if (error) throw error;
    await navigate({ to: loginDestination(search.redirect, data?.[0]?.slug), replace: true });
  }

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) goAfterLogin().catch((e: Error) => toast.error("Não foi possível abrir seu casamento", { description: e.message }));
    });
  }, [navigate, search.redirect]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await goAfterLogin();
    } catch (e) {
      toast.error("Não foi possível entrar", { description: (e as Error).message });
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-romance flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <Heart className="size-5 text-accent" />
          <span className="font-display text-2xl">{BRAND.name}</span>
        </Link>

        <Card className="shadow-soft border-border/70">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Entrar</CardTitle>
            <CardDescription>
              Acesse com seu e-mail e senha. Convidados: use a senha do casamento informada pelos noivos.
            </CardDescription>
          </CardHeader>
          <CardContent>
              <form className="space-y-4" onSubmit={handleSignIn}>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                São os noivos?{" "}
                <Link to="/criar-conta" className="underline">
                  Criar o site do casamento
                </Link>
              </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/termos" className="underline">
            Termos de uso
          </Link>{" "}
          ·{" "}
          <Link to="/privacidade" className="underline">
            Política de privacidade
          </Link>
        </p>
      </div>
    </div>
  );
}
