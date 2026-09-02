import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Link2, ShieldCheck, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { useMyRoles } from "@/hooks/useRoles";
import { claimFirstAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({
    meta: [
      { title: "Super admin · Nosso Casamento" },
      {
        name: "description",
        content:
          "Gere links de convite para liberar acesso aos noivos e aos convidados do site de casamento.",
      },
      { property: "og:title", content: "Super admin · Nosso Casamento" },
      {
        property: "og:description",
        content: "Controle de acessos: convites para noivos e convidados.",
      },
    ],
  }),
  component: SuperAdminPage,
});

function newToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
}

function SuperAdminPage() {
  const { user } = useSession();
  const { isSuperAdmin, isLoading } = useMyRoles(user?.id);
  const queryClient = useQueryClient();
  const claim = useServerFn(claimFirstAdmin);
  const [role, setRole] = useState<"owner" | "guest">("owner");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("30");

  const invitesQuery = useQuery({
    queryKey: ["invites"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const expires =
        Number(days) > 0
          ? new Date(Date.now() + Number(days) * 86_400_000).toISOString()
          : null;
      const { error } = await supabase.from("wedding_invites").insert({
        token: newToken(),
        role,
        email: email.trim() || null,
        note: note.trim() || null,
        expires_at: expires,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite gerado!");
      setEmail("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (e: Error) => toast.error("Erro ao gerar convite", { description: e.message }),
  });

  const removeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invites"] }),
  });

  async function copyLink(token: string) {
    const url = `${window.location.origin}/convite/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!", { description: url });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-16 text-center text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-16">
          <Card className="shadow-card">
            <CardHeader className="text-center">
              <CardTitle className="font-display text-2xl">Área restrita</CardTitle>
              <CardDescription>
                Somente o super administrador pode gerenciar acessos.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await claim({});
                    toast[res.granted ? "success" : "error"](res.reason);
                    queryClient.invalidateQueries({ queryKey: ["my-roles"] });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <ShieldCheck className="size-4" /> Tornar-me super admin
              </Button>
              <p className="text-xs text-muted-foreground">
                Disponível apenas enquanto não houver nenhum super administrador.
              </p>
              <Button asChild variant="ghost" size="sm">
                <Link to="/">Voltar ao início</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-12">
        <div>
          <h1 className="font-display text-4xl">Super admin</h1>
          <p className="mt-2 text-muted-foreground">
            Gere links de acesso: perfil <strong>noivos</strong> libera a área de edição do site;
            perfil <strong>convidado</strong> libera apenas a navegação e a lista de presentes.
          </p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Novo convite</CardTitle>
            <CardDescription>
              O link só funciona depois que a pessoa criar a conta ou entrar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                createInvite.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="role">Tipo de acesso</Label>
                <select
                  id="role"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "owner" | "guest")}
                >
                  <option value="owner">Noivos (área de edição)</option>
                  <option value="guest">Convidado</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="days">Validade (dias)</Label>
                <Input
                  id="days"
                  type="number"
                  min={0}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail (opcional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Observação (opcional)</Label>
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createInvite.isPending}>
                  <Link2 className="size-4" /> Gerar link de convite
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Convites gerados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(invitesQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum convite gerado ainda.</p>
            ) : (
              (invitesQuery.data ?? []).map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={invite.role === "owner" ? "default" : "secondary"}>
                        {invite.role === "owner" ? "Noivos" : "Convidado"}
                      </Badge>
                      {invite.used_at ? (
                        <Badge variant="outline">Utilizado</Badge>
                      ) : invite.expires_at && new Date(invite.expires_at) < new Date() ? (
                        <Badge variant="outline">Expirado</Badge>
                      ) : (
                        <Badge variant="outline">Ativo</Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      /convite/{invite.token}
                      {invite.email ? ` · ${invite.email}` : ""}
                      {invite.note ? ` · ${invite.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => copyLink(invite.token)}>
                      <Copy className="size-4" /> Copiar link
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir convite"
                      onClick={() => removeInvite.mutate(invite.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
