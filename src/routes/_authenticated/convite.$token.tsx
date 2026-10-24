import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/convite/$token")({
  head: () => ({
    meta: [
      { title: "Convite de acesso · Nosso Casamento" },
      {
        name: "description",
        content: "Use seu link de convite para liberar o acesso como noivos ou como convidado.",
      },
      { property: "og:title", content: "Convite de acesso" },
      { property: "og:description", content: "Ative seu acesso ao site do casamento." },
    ],
  }),
  component: RedeemInvitePage,
});

function RedeemInvitePage() {
  const { token } = useParams({ from: "/_authenticated/convite/$token" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [role, setRole] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [needsWedding, setNeedsWedding] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestCpf, setGuestCpf] = useState("");
  const [contactKind, setContactKind] = useState<"phone" | "cpf" | "email">("phone");
  const [saving, setSaving] = useState(false);

  async function registerGuest() {
    setSaving(true);
    const { data, error } = await supabase.rpc("register_guest_contact_by_invite", {
      p_token: token,
      p_name: guestName,
      p_kind: contactKind,
      p_value: guestCpf,
    });
    setSaving(false);
    if (error) {
      toast.error("Não deu para concluir", { description: error.message });
      return;
    }
    toast.success("Perfil criado!");
    navigate({ to: "/casamento/$slug/confirmar", params: { slug: data as string }, replace: true });
  }

  useEffect(() => {
    let active = true;
    supabase.rpc("redeem_invite", { _token: token }).then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        setState("error");
        setMessage(error.message);
        return;
      }
      const redeemedRole = data as string;
      if (redeemedRole === "guest") {
        const { data: info } = await supabase.rpc("invite_public_info", { _token: token });
        const row = info?.[0];
        if (row?.guest_name && row.slug) {
          queryClient.invalidateQueries({ queryKey: ["my-roles"] });
          navigate({ to: "/casamento/$slug/confirmar", params: { slug: row.slug }, replace: true });
          return;
        }
      }
      setRole(redeemedRole);
      if (redeemedRole === "owner") {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          const { data: mine } = await supabase
            .from("weddings")
            .select("id")
            .eq("owner_id", auth.user.id)
            .limit(1);
          if (active) setNeedsWedding((mine ?? []).length === 0);
        }
      }
      if (!active) return;
      setState("ok");
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
      queryClient.invalidateQueries({ queryKey: ["my-wedding"] });
    });
    return () => {
      active = false;
    };
  }, [token, queryClient, navigate]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-3xl">Convite de acesso</CardTitle>
            <CardDescription>
              {state === "loading" && "Validando seu convite..."}
              {state === "ok" &&
                (role === "owner"
                  ? needsWedding
                    ? "Acesso liberado como noivos. Agora é só criar o casamento de vocês."
                    : "Acesso liberado como noivos. O casamento já está vinculado à sua conta."
                  : role === "admin"
                    ? "Acesso liberado como super administrador."
                    : "Acesso liberado como convidado.")}
              {state === "error" && message}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {state === "ok" && <CheckCircle2 className="size-10 text-accent" />}
            {state === "error" && <XCircle className="text-destructive size-10" />}
            {state === "ok" && role === "guest" && (
              <div className="w-full space-y-3">
                <p className="text-sm text-muted-foreground">
                  Informe seu nome completo e só um destes dados: telefone, CPF ou e-mail. Use o mesmo que você passou para os noivos.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="gname">Nome completo</Label>
                  <Input id="gname" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["phone", "cpf", "email"] as const).map((k) => (
                    <Button
                      key={k}
                      type="button"
                      size="sm"
                      variant={contactKind === k ? "default" : "outline"}
                      onClick={() => {
                        setContactKind(k);
                        setGuestCpf("");
                      }}
                    >
                      {k === "phone" ? "Telefone" : k === "cpf" ? "CPF" : "E-mail"}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gcpf">
                    {contactKind === "phone" ? "Telefone com DDD" : contactKind === "cpf" ? "CPF" : "E-mail"}
                  </Label>
                  <Input
                    id="gcpf"
                    inputMode={contactKind === "email" ? "email" : "numeric"}
                    type={contactKind === "email" ? "email" : "text"}
                    placeholder={
                      contactKind === "phone"
                        ? "(11) 91234-5678"
                        : contactKind === "cpf"
                          ? "000.000.000-00"
                          : "voce@email.com"
                    }
                    value={guestCpf}
                    onChange={(e) => setGuestCpf(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled={saving || !guestCpf.trim()} onClick={registerGuest}>
                  {saving ? "Salvando..." : "Criar meu perfil"}
                </Button>
              </div>
            )}
            {state === "ok" && role !== "guest" && (
              <Button
                onClick={() =>
                  navigate({
                    to: role === "guest" ? "/" : needsWedding ? "/criar-conta" : "/painel",
                    replace: true,
                  })
                }
              >
                {role === "guest"
                  ? "Ir para o site"
                  : needsWedding
                    ? "Criar nosso casamento"
                    : "Ir para a área dos noivos"}
              </Button>
            )}
            {state === "error" && (
              <Button variant="outline" onClick={() => navigate({ to: "/" })}>
                Voltar ao início
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
