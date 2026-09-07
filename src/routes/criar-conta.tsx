import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Heart } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/criar-conta")({
  head: () => ({
    meta: [
      { title: `Criar o site do casamento · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Crie em minutos o site do seu casamento: páginas do casal, confirmação de presença e lista de presentes com Pix, débito e crédito.",
      },
      { property: "og:title", content: `Criar o site do casamento · ${BRAND.name}` },
      {
        property: "og:description",
        content: "Cadastro dos noivos: escolha o endereço do site e comece a montar a lista.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignUpPage,
});

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function SignUpPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [bride, setBride] = useState("");
  const [groom, setGroom] = useState("");
  const [date, setDate] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);

  const finalSlug = useMemo(
    () => slugify(slug || (bride && groom ? `${bride}-e-${groom}` : "")),
    [slug, bride, groom],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      toast.error("É preciso aceitar os termos e a política de privacidade.");
      return;
    }
    setLoading(true);
    try {
      const { data: signUp, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: { full_name: `${bride.trim()} e ${groom.trim()}`, phone: phone.trim() },
        },
      });
      if (signUpError) throw signUpError;

      if (!signUp.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          toast.success("Conta criada!", {
            description: "Confirme seu e-mail e entre para continuar.",
          });
          navigate({ to: "/auth" });
          return;
        }
      }

      const { data, error } = await supabase.rpc("create_own_wedding", {
        p_bride: bride.trim(),
        p_groom: groom.trim(),
        p_slug: finalSlug,
        ...(date ? { p_date: date } : {}),
      });
      if (error) throw error;

      const created = data?.[0];
      if (created && phone.trim()) {
        await supabase
          .from("weddings")
          .update({ notify_whatsapp: phone.trim() })
          .eq("id", created.wedding_id);
      }

      toast.success("Site criado!", { description: "Personalize tudo por aqui. A publicação para os convidados é liberada pela nossa equipe." });
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      toast.error("Não foi possível criar a conta", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-romance flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <Heart className="size-5 text-accent" />
          <span className="font-display text-2xl">{BRAND.name}</span>
        </Link>

        <Card className="shadow-soft border-border/70">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Criar o site do casamento</CardTitle>
            <CardDescription>
              Em poucos minutos vocês têm o site no ar, com lista de presentes e confirmação de
              presença. Os convidados entram por convite de vocês.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bride">Nome da noiva</Label>
                  <Input id="bride" required value={bride} onChange={(e) => setBride(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groom">Nome do noivo</Label>
                  <Input id="groom" required value={groom} onChange={(e) => setGroom(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Endereço do site</Label>
                <Input
                  id="slug"
                  placeholder="beatriz-e-pedro"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Ficará assim: /casamento/{finalSlug || "nomes-do-casal"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Data do casamento</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp para avisos</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    placeholder="(19) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail de acesso</Label>
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
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="flex items-start gap-3 rounded-md border border-border/70 p-3">
                <Checkbox
                  id="terms"
                  checked={accepted}
                  onCheckedChange={(v) => setAccepted(v === true)}
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed font-normal">
                  Li e aceito os{" "}
                  <Link to="/termos" className="underline">
                    Termos de uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" className="underline">
                    Política de privacidade
                  </Link>
                  .
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Criando..." : "Criar meu site"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/auth" className="underline">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
