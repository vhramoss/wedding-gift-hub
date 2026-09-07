import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { AnnouncementsTab } from "@/components/admin/AnnouncementsTab";
import { InviteManager } from "@/components/InviteManager";
import { VendorDirectory } from "@/components/VendorDirectory";
import { AppearanceTab } from "@/components/admin/AppearanceTab";
import { FinanceTab } from "@/components/admin/FinanceTab";

import { WeddingContentTab } from "@/components/admin/WeddingContentTab";
import { WeddingPhotosTab } from "@/components/admin/WeddingPhotosTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentAccountTab } from "@/components/painel/PaymentAccountTab";
import { PayoutSummary } from "@/components/painel/PayoutSummary";
import { downloadCsv } from "@/lib/csv";
import { useSession } from "@/hooks/useSession";
import { useMyRoles } from "@/hooks/useRoles";
import { useMyWedding } from "@/hooks/useMyWedding";
import { formatBRL, PAYMENT_LABELS, type PaymentMethod } from "@/lib/br";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Área dos noivos · Nosso Casamento" },
      {
        name: "description",
        content:
          "Edite as páginas do seu site de casamento, envie fotos, monte a lista de presentes e acompanhe confirmações.",
      },
      { property: "og:title", content: "Área dos noivos" },
      {
        property: "og:description",
        content: "Personalize o site do casamento, fotos, presentes e confirmações.",
      },
    ],
  }),
  component: CouplePanel,
});

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toCents(value: string) {
  const n = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function CouplePanel() {
  const { user } = useSession();
  const { isOwner, isLoading: rolesLoading } = useMyRoles(user?.id);
  const queryClient = useQueryClient();
  const weddingQuery = useMyWedding(user?.id);
  const wedding = weddingQuery.data;
  const weddingId = wedding?.id ?? null;

  const giftsQuery = useQuery({
    queryKey: ["panel", "gifts", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("*")
        .eq("wedding_id", weddingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["panel", "orders", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, gifts(name)")
        .eq("wedding_id", weddingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const donorsQuery = useQuery({
    queryKey: ["panel", "donors", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wedding_donors", {
        _wedding_id: weddingId!,
      });
      if (error) throw error;
      return data;
    },
  });

  const rsvpsQuery = useQuery({
    queryKey: ["panel", "rsvps", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("wedding_id", weddingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createWedding = useMutation({
    mutationFn: async (form: FormData) => {
      const bride = String(form.get("bride") ?? "").trim();
      const groom = String(form.get("groom") ?? "").trim();
      if (!bride || !groom) throw new Error("Informe o nome dos dois noivos.");
      const { error } = await supabase.from("weddings").insert({
        owner_id: user!.id,
        slug: slugify(`${bride}-e-${groom}`) || `casal-${Date.now()}`,
        bride_name: bride,
        groom_name: groom,
        wedding_date: String(form.get("date") ?? "") || null,
        venue: String(form.get("venue") ?? "").trim() || null,
        pix_key: String(form.get("pix") ?? "").trim() || null,
        pix_holder: String(form.get("pixHolder") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site criado! Agora é só personalizar.");
      queryClient.invalidateQueries({ queryKey: ["my-wedding", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["main-wedding"] });
    },
    onError: (e: Error) => toast.error("Erro ao criar", { description: e.message }),
  });

  const createGift = useMutation({
    mutationFn: async (form: FormData) => {
      const priceCents = toCents(String(form.get("price") ?? ""));
      if (priceCents <= 0) throw new Error("Informe um valor válido (ex.: 350,00).");
      const { error } = await supabase.from("gifts").insert({
        wedding_id: weddingId!,
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? "").trim() || null,
        category: String(form.get("category") ?? "").trim() || null,
        image_url: String(form.get("image") ?? "").trim() || null,
        price_cents: priceCents,
        quantity: Math.max(1, Number(form.get("quantity") ?? 1)),
        shares_total: Math.max(1, Number(form.get("shares_total") ?? 1)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Presente adicionado!");
      queryClient.invalidateQueries({ queryKey: ["panel", "gifts", weddingId] });
    },
    onError: (e: Error) => toast.error("Erro ao adicionar", { description: e.message }),
  });

  const removeGift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gifts").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Presente removido da lista.");
      queryClient.invalidateQueries({ queryKey: ["panel", "gifts", weddingId] });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel", "orders", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["panel", "gifts", weddingId] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  if (rolesLoading || weddingQuery.isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-16 text-center text-muted-foreground">Carregando sua área...</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-16">
          <Card className="shadow-card">
            <CardHeader className="text-center">
              <CardTitle className="font-display text-2xl">Área exclusiva dos noivos</CardTitle>
              <CardDescription>
                Sua conta é de convidado. O acesso à área de edição é liberado apenas por um link de
                convite enviado pelo administrador do site.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild variant="outline">
                <Link to="/">Voltar ao site</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!wedding) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Criar o site do casamento</CardTitle>
              <CardDescription>
                Preencha o básico agora. Depois vocês editam textos, fotos e a lista de presentes
                quando quiserem.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  createWedding.mutate(new FormData(e.currentTarget));
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="bride">Nome da noiva</Label>
                  <Input id="bride" name="bride" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groom">Nome do noivo</Label>
                  <Input id="groom" name="groom" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Data do casamento</Label>
                  <Input id="date" name="date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue">Local</Label>
                  <Input id="venue" name="venue" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pix">Chave Pix</Label>
                  <Input id="pix" name="pix" placeholder="CPF, e-mail, telefone ou aleatória" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pixHolder">Titular da chave Pix</Label>
                  <Input id="pixHolder" name="pixHolder" />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={createWedding.isPending}>
                    <Plus className="size-4" /> Criar nosso site
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalPaid = (ordersQuery.data ?? [])
    .filter((o) => o.status === "paid")
    .reduce((acc, o) => acc + o.amount_cents, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">Área dos noivos</h1>
            <p className="mt-2 break-words text-sm text-muted-foreground sm:text-base">
              {wedding.bride_name} & {wedding.groom_name} · /casamento/{wedding.slug}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/casamento/$slug" params={{ slug: wedding.slug }}>
              <ExternalLink className="size-4" /> Ver nosso site
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="content" className="mt-8">
          <TabsList>
            <TabsTrigger value="content">Nosso site</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            <TabsTrigger value="announcements">Avisos</TabsTrigger>
            <TabsTrigger value="gifts">Presentes</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="rsvps">Confirmações</TabsTrigger>
            <TabsTrigger value="invites">Convites</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="finance">Financeiro</TabsTrigger>
            <TabsTrigger value="payments">Recebimento</TabsTrigger>
            <TabsTrigger value="vendors">Fornecedores</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-6">
            <WeddingContentTab weddingId={weddingId} />
          </TabsContent>

          <TabsContent value="photos" className="mt-6">
            <WeddingPhotosTab weddingId={weddingId} />
          </TabsContent>

          <TabsContent value="announcements" className="mt-6">
            <AnnouncementsTab weddingId={weddingId} />
          </TabsContent>

          <TabsContent value="gifts" className="mt-6 space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-xl">Adicionar presente</CardTitle>
                <CardDescription>
                  Cadastre o item e o valor que vocês querem receber por ele.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(e) => {
                    const el = e.currentTarget;
                    e.preventDefault();
                    createGift.mutate(new FormData(el), { onSuccess: () => el.reset() });
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="name">Item</Label>
                    <Input id="name" name="name" required maxLength={120} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input id="category" name="category" placeholder="Cozinha, Lua de mel..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Valor (R$)</Label>
                    <Input id="price" name="price" required placeholder="350,00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantidade</Label>
                    <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shares_total">Dividir em cotas</Label>
                    <Input
                      id="shares_total"
                      name="shares_total"
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use 1 para presente inteiro. Acima disso, vários convidados podem dividir o
                      valor.
                    </p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="image">URL da imagem (opcional)</Label>
                    <Input id="image" name="image" placeholder="https://..." />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea id="description" name="description" maxLength={500} />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={createGift.isPending}>
                      <Plus className="size-4" /> Adicionar à lista
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {(giftsQuery.data ?? []).map((gift) => (
                <Card key={gift.id} className={gift.active ? "" : "opacity-50"}>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg">{gift.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatBRL(gift.price_cents)} · {gift.purchased_count}/
                        {(gift.shares_total ?? 1) > 1 ? gift.shares_total : gift.quantity}{" "}
                        {(gift.shares_total ?? 1) > 1 ? "cotas · " : ""}
                        presenteado(s)
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGift.mutate(gift.id)}
                      aria-label={`Remover ${gift.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-6 space-y-4">
            <Card className="shadow-card">
              <CardContent className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Total recebido (pagamentos pagos)</span>
                <span className="text-2xl font-medium text-primary sm:text-3xl">{formatBRL(totalPaid)}</span>
              </CardContent>
            </Card>

            <PayoutSummary weddingId={weddingId} />

            <Card className="shadow-card">
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-medium">Quem presenteou</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadCsv(
                        "quem-presenteou.csv",
                        [
                          "Convidado",
                          "Presente",
                          "E-mail",
                          "Telefone",
                          "Valor",
                          "Forma",
                          "Parcelas",
                          "Situação",
                          "Recado",
                          "Data",
                        ],
                        (donorsQuery.data ?? []).map((d) => [
                          d.guest_name,
                          d.gift_name ?? "",
                          d.guest_email ?? "",
                          d.guest_phone ?? "",
                          formatBRL(d.total_cents),
                          PAYMENT_LABELS[d.payment_method as PaymentMethod] ?? d.payment_method,
                          d.installments,
                          d.status,
                          d.message ?? "",
                          new Date(d.paid_at ?? d.created_at).toLocaleString("pt-BR"),
                        ]),
                      )
                    }
                  >
                    <Download className="size-4" /> Exportar planilha
                  </Button>
                </div>
                {(donorsQuery.data ?? []).filter((d) => d.status === "paid").length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum presente pago ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(donorsQuery.data ?? [])
                      .filter((d) => d.status === "paid")
                      .map((d) => (
                        <div
                          key={d.order_id}
                          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                        >
                          <div>
                            <p className="font-medium">{d.guest_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Presenteou: {d.gift_name ?? "Presente"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[d.guest_email, d.guest_phone].filter(Boolean).join(" · ")}
                            </p>
                            {d.message ? (
                              <p className="mt-1 text-sm italic text-muted-foreground">
                                “{d.message}”
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-primary">{formatBRL(d.amount_cents)}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.paid_at
                                ? new Date(d.paid_at).toLocaleDateString("pt-BR")
                                : new Date(d.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {(ordersQuery.data ?? []).map((order) => (
              <Card key={order.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg">{order.gifts?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {order.guest_name || "Convidado"} ·{" "}
                      {PAYMENT_LABELS[order.payment_method as PaymentMethod]}
                      {order.installments > 1 ? ` em ${order.installments}x` : ""} ·{" "}
                      {new Date(order.created_at).toLocaleString("pt-BR")}
                    </p>
                    {order.message ? (
                      <p className="mt-1 text-sm italic text-muted-foreground">“{order.message}”</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xl font-medium text-primary">
                        {formatBRL(order.total_cents)}
                      </p>
                      <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                        {order.status === "paid"
                          ? "Pago"
                          : order.status === "pending"
                            ? "Pendente"
                            : "Cancelado"}
                      </Badge>
                    </div>
                    {order.status !== "paid" ? (
                      <Button
                        size="sm"
                        onClick={() => updateOrder.mutate({ id: order.id, status: "paid" })}
                      >
                        Marcar pago
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(ordersQuery.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhum pedido ainda.</p>
            ) : null}
          </TabsContent>

          <TabsContent value="rsvps" className="mt-6 space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    "confirmacoes.csv",
                    [
                      "Convidado",
                      "Vai ao casamento",
                      "Cerimônia",
                      "Festa",
                      "Acompanhantes",
                      "Restrição alimentar",
                      "Recado",
                      "Data",
                    ],
                    (rsvpsQuery.data ?? []).map((r) => [
                      r.guest_name || "Convidado",
                      r.attending ? "Sim" : "Não",
                      r.attending_ceremony ? "Sim" : "Não",
                      r.attending_party ? "Sim" : "Não",
                      r.companions,
                      r.dietary_notes ?? "",
                      r.message ?? "",
                      new Date(r.created_at).toLocaleString("pt-BR"),
                    ]),
                  )
                }
              >
                <Download className="size-4" /> Exportar planilha
              </Button>
            </div>
            {(rsvpsQuery.data ?? []).map((rsvp) => (
              <Card key={rsvp.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="mb-2 font-medium">{rsvp.guest_name || "Convidado"}</p>
                    <Badge variant={rsvp.attending ? "default" : "secondary"}>
                      {rsvp.attending ? "Confirmado" : "Não vai"}
                    </Badge>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Acompanhantes: {rsvp.companions}
                    </p>
                    {rsvp.attending ? (
                      <p className="text-sm text-muted-foreground">
                        Cerimônia: {rsvp.attending_ceremony ? "sim" : "não"} · Festa:{" "}
                        {rsvp.attending_party ? "sim" : "não"}
                      </p>
                    ) : null}
                    {rsvp.dietary_notes ? (
                      <p className="text-sm text-muted-foreground">
                        Restrição alimentar: {rsvp.dietary_notes}
                      </p>
                    ) : null}
                    {rsvp.message ? (
                      <p className="mt-1 text-sm italic text-muted-foreground">“{rsvp.message}”</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(rsvp.created_at).toLocaleString("pt-BR")}
                  </span>
                </CardContent>
              </Card>
            ))}
            {(rsvpsQuery.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhuma confirmação registrada.</p>
            ) : null}
          </TabsContent>

          <TabsContent value="invites" className="mt-6">
            <InviteManager
              weddingId={weddingId}
              roles={["guest"]}
              title="Convidar convidados"
              description="Gere um link e um QR Code para cada convidado criar o login e acessar o site."
            />
          </TabsContent>

          <TabsContent value="appearance" className="mt-6">
            <AppearanceTab weddingId={weddingId} />
          </TabsContent>

          <TabsContent value="finance" className="mt-6">
            <FinanceTab weddingId={weddingId} />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <PaymentAccountTab weddingId={weddingId} />
          </TabsContent>

          <TabsContent value="vendors" className="mt-6">
            <VendorDirectory message="Olá! Somos noivos e gostaríamos de um orçamento para o nosso casamento." />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
