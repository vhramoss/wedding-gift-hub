import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/entrar/$token")({
  head: () => ({
    meta: [
      { title: `Seu convite · ${BRAND.name}` },
      { name: "description", content: "Crie seu perfil de convidado em segundos e confirme sua presença." },
      { property: "og:title", content: `Seu convite de casamento · ${BRAND.name}` },
      { property: "og:description", content: "Abra seu convite e confirme sua presença." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestEntryPage,
});

function GuestEntryPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const goRedeem = () => navigate({ to: "/convite/$token", params: { token }, replace: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goRedeem();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const info = useQuery({
    queryKey: ["invite-info", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("invite_public_info", { _token: token });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const inv = info.data;
  const sharedPassword = inv?.guest_password ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pass = sharedPassword || password;
    if (pass.length < 6) return toast.error("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    try {
      const mail = email.trim().toLowerCase();
      const signIn = await supabase.auth.signInWithPassword({ email: mail, password: pass });
      if (!signIn.error) return goRedeem();
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password: pass,
        options: {
          emailRedirectTo: `${window.location.origin}/entrar/${token}`,
          data: { full_name: inv?.guest_name ?? "" },
        },
      });
      if (error) throw error;
      if (data.session) return goRedeem();
      setCheckEmail(true);
    } catch (err) {
      toast.error("Não foi possível continuar", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-romance flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="shadow-soft w-full max-w-md border-border/70">
        <CardHeader className="text-center">
          <Heart className="mx-auto size-6 text-accent" />
          <CardTitle className="font-display text-3xl">
            {inv?.bride_name ? `${inv.bride_name} & ${inv.groom_name}` : "Seu convite"}
          </CardTitle>
          <CardDescription>
            {inv?.guest_name ? `Olá, ${inv.guest_name}! ` : ""}
            Informe seu e-mail para criar seu perfil e confirmar presença.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {info.isLoading ? null : !inv?.valid ? (
            <div className="space-y-4 text-center">
              <XCircle className="text-destructive mx-auto size-8" />
              <p className="text-sm text-muted-foreground">
                Este convite já foi usado ou não é mais válido. Se você já criou seu perfil, entre com seu
                e-mail e a senha do casamento.
              </p>
              <Button onClick={() => navigate({ to: "/auth" })}>Entrar</Button>
            </div>
          ) : checkEmail ? (
            <p className="text-center text-sm text-muted-foreground">
              Enviamos um link para <strong>{email}</strong>. Abra seu e-mail, confirme e você volta
              direto para cá.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {sharedPassword ? (
                <p className="rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
                  Não precisa criar senha. Para entrar de novo depois, use a senha do casamento que os
                  noivos compartilharam: <strong>{sharedPassword}</strong>
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="pw">Crie uma senha</Label>
                  <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Aguarde..." : "Continuar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
