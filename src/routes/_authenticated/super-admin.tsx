import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Percent, ShieldCheck, Trash2, Unlink, UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { InviteManager } from "@/components/InviteManager";
import { VendorsAdminTab } from "@/components/admin/VendorsAdminTab";
import { AccountsByWeddingTab } from "@/components/admin/AccountsByWeddingTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/useSession";
import { useMyRoles, type AppRole } from "@/hooks/useRoles";
import { formatBRL } from "@/lib/br";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({
    meta: [
      { title: `Administração · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Administre todos os casamentos, acessos de noivos e convidados, taxas de comissão e convites com QR Code.",
      },
      { property: "og:title", content: `Administração · ${BRAND.name}` },
      {
        property: "og:description",
        content: "Casamentos, acessos, comissões e convites em um só painel.",
      },
    ],
  }),
  component: SuperAdminPage,
});

type Wedding = { id: string; slug: string; bride_name: string; groom_name: string; owner_id: string | null; published: boolean; commission_percent: number | string | null; wedding_date: string | null };

function SuperAdminPage() {
  const { user } = useSession();
  const { isSuperAdmin, isLoading } = useMyRoles(user?.id);
  const queryClient = useQueryClient();
  const [isClaimingAdmin, setIsClaimingAdmin] = useState(false);

  const weddingsQuery = useQuery({
    queryKey: ["admin", "weddings"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Wedding[];
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, wedding_id, amount_cents, status, created_at, gift_id, gifts(name)");
      if (error) throw error;
      return data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, cpf, phone, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id),
      }));
    },
  });

  const updateWedding = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Wedding> }) => {
      const { error } = await supabase
        .from("weddings")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Casamento atualizado.");
      queryClient.invalidateQueries({ queryKey: ["admin", "weddings"] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const deleteWedding = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weddings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Casamento removido.");
      queryClient.invalidateQueries({ queryKey: ["admin", "weddings"] });
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role, grant }: { userId: string; role: AppRole; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Acesso atualizado.");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (e: Error) => toast.error("Erro ao alterar acesso", { description: e.message }),
  });

  const commissionByWedding = useMemo(() => {
    const map = new Map<string, { paidCents: number; pendingCents: number; count: number }>();
    for (const order of ordersQuery.data ?? []) {
      const current = map.get(order.wedding_id) ?? { paidCents: 0, pendingCents: 0, count: 0 };
      if (order.status === "paid") {
        current.paidCents += order.amount_cents;
        current.count += 1;
      } else {
        current.pendingCents += order.amount_cents;
      }
      map.set(order.wedding_id, current);
    }
    return map;
  }, [ordersQuery.data]);

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
                disabled={isClaimingAdmin || !user}
                onClick={async () => {
                  if (!user) return;
                  setIsClaimingAdmin(true);
                  try {
                    const { error } = await supabase
                      .from("user_roles")
                      .insert({ user_id: user.id, role: "admin" });
                    if (error) throw error;
                    toast.success("Você agora é administrador.");
                    await queryClient.invalidateQueries({ queryKey: ["my-roles"] });
                  } catch (e) {
                    const message = e instanceof Error ? e.message : "Não foi possível liberar o acesso.";
                    toast.error(
                      message.includes("duplicate") ||
                        message.includes("row-level security") ||
                        message.includes("Já existe")
                        ? "Já existe um administrador cadastrado."
                        : message,
                    );
                  } finally {
                    setIsClaimingAdmin(false);
                  }
                }}
              >
                <ShieldCheck className="size-4" />
                {isClaimingAdmin ? "Liberando acesso..." : "Tornar-me super admin"}
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

  const weddings = weddingsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const totalCommission = weddings.reduce((sum, w) => {
    const stats = commissionByWedding.get(w.id);
    const rate = Number(w.commission_percent ?? 0) / 100;
    return sum + Math.round((stats?.paidCents ?? 0) * rate);
  }, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-12">
        <div>
          <h1 className="font-display text-4xl">Administração</h1>
          <p className="mt-2 text-muted-foreground">
            Escolha o casamento que você quer administrar, controle acessos, convites e a sua
            comissão por presente.
          </p>
        </div>

        <Tabs defaultValue="weddings">
          <TabsList>
            <TabsTrigger value="weddings">Casamentos</TabsTrigger>
            <TabsTrigger value="commissions">Comissões</TabsTrigger>
            <TabsTrigger value="accounts">Contas por casamento</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="invites">Convites</TabsTrigger>
            <TabsTrigger value="vendors">Fornecedores</TabsTrigger>
          </TabsList>

          <TabsContent value="weddings" className="mt-6 space-y-4">
            {weddings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum casamento cadastrado ainda.</p>
            ) : (
              weddings.map((w) => {
                const owner = users.find((u) => u.id === w.owner_id);
                return (
                  <Card key={w.id} className="shadow-card">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="font-display text-2xl">
                          {w.bride_name} &amp; {w.groom_name}
                        </CardTitle>
                        <CardDescription>
                          /casamento/{w.slug}
                          {w.wedding_date ? ` · ${w.wedding_date}` : ""}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={w.published ? "default" : "outline"}>
                          {w.published ? "Publicado" : "Rascunho"}
                        </Badge>
                        <Button asChild variant="outline" size="sm">
                          <Link to="/casamento/$slug" params={{ slug: w.slug }}>
                            <ExternalLink className="size-4" /> Abrir site
                          </Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`rate-${w.id}`}>
                            <Percent className="size-3" /> Comissão por presente (%)
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`rate-${w.id}`}
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              defaultValue={Number(w.commission_percent ?? 0)}
                              onBlur={(e) => {
                                const value = Number(e.target.value);
                                if (!Number.isFinite(value) || value === Number(w.commission_percent ?? 0)) return;
                                updateWedding.mutate({ id: w.id, patch: { commission_percent: value } });
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Noivos responsáveis</Label>
                          <p className="text-sm text-muted-foreground">
                            {owner?.full_name || (w.owner_id ? "Usuário sem nome" : "Sem conexão")}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`owner-${w.id}`}>Conectar usuário</Label>
                          <select
                            id={`owner-${w.id}`}
                            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                            value={w.owner_id ?? ""}
                            onChange={(e) => {
                              const value = e.target.value || null;
                              updateWedding.mutate({ id: w.id, patch: { owner_id: value } });
                              if (value) setRole.mutate({ userId: value, role: "owner", grant: true });
                            }}
                          >
                            <option value="">Sem conexão</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.full_name || u.id.slice(0, 8)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateWedding.mutate({ id: w.id, patch: { published: !w.published } })
                          }
                        >
                          {w.published ? "Despublicar" : "Publicar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!w.owner_id}
                          onClick={() => updateWedding.mutate({ id: w.id, patch: { owner_id: null } })}
                        >
                          <Unlink className="size-4" /> Cortar conexão
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Remover definitivamente o casamento de ${w.bride_name} e ${w.groom_name}?`))
                              deleteWedding.mutate(w.id);
                          }}
                        >
                          <Trash2 className="size-4" /> Remover casamento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="commissions" className="mt-6 space-y-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-xl">Comissão total recebida</CardTitle>
                <CardDescription>
                  Soma da sua comissão sobre todos os presentes já pagos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-display text-4xl text-accent">{formatBRL(totalCommission)}</p>
              </CardContent>
            </Card>

            {weddings.map((w) => {
              const stats = commissionByWedding.get(w.id);
              const rate = Number(w.commission_percent ?? 0);
              const paid = stats?.paidCents ?? 0;
              const pending = stats?.pendingCents ?? 0;
              return (
                <Card key={w.id} className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {w.bride_name} &amp; {w.groom_name}
                    </CardTitle>
                    <CardDescription>
                      Taxa atual: {rate}% · {stats?.count ?? 0} presente(s) pago(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-4">
                    <Stat label="Presentes pagos" value={formatBRL(paid)} />
                    <Stat label="Sua comissão" value={formatBRL(Math.round((paid * rate) / 100))} accent />
                    <Stat label="Aguardando pagamento" value={formatBRL(pending)} />
                    <div className="space-y-2">
                      <Label htmlFor={`rate2-${w.id}`}>Ajustar taxa (%)</Label>
                      <Input
                        id={`rate2-${w.id}`}
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        defaultValue={rate}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (!Number.isFinite(value) || value === rate) return;
                          updateWedding.mutate({ id: w.id, patch: { commission_percent: value } });
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="accounts" className="mt-6">
            <AccountsByWeddingTab />
          </TabsContent>

          <TabsContent value="users" className="mt-6 space-y-3">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
            ) : (
              users.map((u) => {
                const roles = u.roles.map((r) => r.role as AppRole);
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{u.full_name || "Sem nome"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.cpf ? `CPF ${u.cpf} · ` : ""}
                        {u.phone ? `${u.phone} · ` : ""}
                        {roles.length ? roles.join(", ") : "sem perfil"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(["owner", "guest"] as AppRole[]).map((role) => {
                        const has = roles.includes(role);
                        return (
                          <Button
                            key={role}
                            variant={has ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setRole.mutate({ userId: u.id, role, grant: !has })}
                          >
                            {has ? <Trash2 className="size-4" /> : <UserPlus className="size-4" />}
                            {has
                              ? `Remover ${role === "owner" ? "noivos" : "convidado"}`
                              : `Dar acesso ${role === "owner" ? "noivos" : "convidado"}`}
                          </Button>
                        );
                      })}
                      {roles.includes("admin") ? <Badge>Super admin</Badge> : null}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="invites" className="mt-6">
            <InviteManager
              roles={["owner", "guest"]}
              description="Perfil noivos libera a área de edição; perfil convidado libera a navegação e a lista de presentes."
            />
          </TabsContent>

          <TabsContent value="vendors" className="mt-6">
            <VendorsAdminTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}
