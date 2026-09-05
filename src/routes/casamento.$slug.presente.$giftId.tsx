import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  QrCode,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/useSession";
import {
  computeCharge,
  formatBRL,
  onlyDigits,
  PAYMENT_LABELS,
  type PaymentMethod,
} from "@/lib/br";
import {
  createPixPayment,
  getMercadoPagoConfig,
  processCardPayment,
} from "@/lib/mercadopago.functions";

const MercadoPagoCardPayment = lazy(() => import("@/components/MercadoPagoCardPayment"));

export const Route = createFileRoute("/casamento/$slug/presente/$giftId")({
  head: () => ({
    meta: [
      { title: "Presentear os noivos · Pagamento" },
      {
        name: "description",
        content:
          "Escolha a forma de pagamento — Pix ou cartão — e finalize o presente com segurança.",
      },
      { property: "og:title", content: "Presentear os noivos · Pagamento" },
      {
        property: "og:description",
        content: "Finalize o presente com Pix ou cartão de crédito.",
      },
    ],
  }),
  component: CheckoutPage,
});

type Phase = "form" | "pix" | "card" | "result";
type PayResult = { status: "paid" | "pending" | "cancelled"; detail: string };

function CheckoutPage() {
  const { slug, giftId } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [messageToCouple, setMessageToCouple] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeBase64: string;
    orderId: string;
  } | null>(null);
  const [cardOrderId, setCardOrderId] = useState<string | null>(null);
  const [cardResult, setCardResult] = useState<PayResult | null>(null);
  const [copied, setCopied] = useState(false);

  const mpConfig = useQuery({
    queryKey: ["mp-config"],
    queryFn: () => getMercadoPagoConfig(),
  });
  const mpEnabled = Boolean(mpConfig.data?.enabled);
  const mpPublicKey = mpConfig.data?.publicKey ?? "";

  const createPix = useServerFn(createPixPayment);
  const processCard = useServerFn(processCardPayment);

  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/auth",
        search: { redirect: `/casamento/${slug}/presente/${giftId}` },
        replace: true,
      });
    }
  }, [loading, user, navigate, slug, giftId]);

  const giftQuery = useQuery({
    queryKey: ["gift", giftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("*, weddings!inner(id, slug, bride_name, groom_name, pix_key, pix_holder)")
        .eq("id", giftId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, cpf")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const gift = giftQuery.data;
  const wedding = gift?.weddings;

  const charge = useMemo(
    () => computeCharge(gift?.price_cents ?? 0, method, installments),
    [gift?.price_cents, method, installments],
  );

  // Cria o pedido pendente (mesmo schema de antes, sem marcar como pago).
  const createOrder = useMutation({
    mutationFn: async (targetMethod: PaymentMethod) => {
      if (!gift || !user) throw new Error("Sessão expirada.");
      const { data, error } = await supabase
        .from("orders")
        .insert({
          wedding_id: gift.wedding_id,
          gift_id: gift.id,
          user_id: user.id,
          guest_name: profileQuery.data?.full_name ?? "",
          guest_cpf: profileQuery.data?.cpf ?? null,
          payment_method: targetMethod,
          installments: targetMethod === "credit" ? installments : 1,
          amount_cents: gift.price_cents,
          fee_cents: charge.feeCents,
          total_cents: charge.totalCents,
          message: messageToCouple.trim() || null,
          status: "pending",
          paid_at: null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onError: (e: Error) => toast.error("Não foi possível criar o pedido", { description: e.message }),
  });

  // --- Pix flow ---
  const startPix = useMutation({
    mutationFn: async () => {
      const orderId = await createOrder.mutateAsync("pix");
      const res = await createPix({ data: { orderId } });
      return { orderId, ...res };
    },
    onSuccess: (res) => {
      setPixData({
        qrCode: res.qrCode,
        qrCodeBase64: res.qrCodeBase64,
        orderId: res.orderId,
      });
      setPhase("pix");
      toast.success("Pedido criado! Pague com o QR Code abaixo.");
    },
    onError: (e: Error) => toast.error("Falha ao gerar Pix", { description: e.message }),
  });

  // Poll status do pedido Pix
  useEffect(() => {
    if (phase !== "pix" || !pixData?.orderId) return;
    let active = true;
    const check = async () => {
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("id", pixData.orderId)
        .maybeSingle();
      if (active && data?.status === "paid") {
        toast.success("Pagamento confirmado! Obrigado pelo presente.");
        navigate({ to: "/meus-presentes" });
      }
    };
    const interval = setInterval(check, 5000);
    check();
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [phase, pixData, navigate]);

  // --- Card flow ---
  const startCard = useMutation({
    mutationFn: async () => {
      const orderId = await createOrder.mutateAsync(method);
      setCardOrderId(orderId);
      setPhase("card");
    },
    onError: (e: Error) => toast.error("Não foi possível iniciar o pagamento", { description: e.message }),
  });

  const submitCard = async (cardData: {
    token: string;
    paymentMethodId: string;
    issuerId?: string;
    installments: number;
  }) => {
    if (!cardOrderId) return;
    try {
      const res = await processCard({
        data: { orderId: cardOrderId, ...cardData },
      });
      setCardResult({ status: res.status, detail: res.detail });
      setPhase("result");
      if (res.status === "paid") {
        toast.success("Pagamento aprovado. Obrigado pelo presente!");
        setTimeout(() => navigate({ to: "/meus-presentes" }), 2500);
      } else if (res.status === "cancelled") {
        toast.error("Pagamento recusado.");
      } else {
        toast.warning("Pagamento em processamento. Aguarde a confirmação.");
      }
    } catch (e) {
      toast.error("Falha no pagamento", {
        description: e instanceof Error ? e.message : undefined,
      });
      setCardResult({ status: "cancelled", detail: "Erro ao processar" });
      setPhase("result");
    }
  };

  if (giftQuery.isLoading || loading) {
    return (
      <div>
        <div className="mx-auto max-w-3xl space-y-4 p-8">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (!gift || !wedding) {
    return (
      <div>
        <div className="mx-auto max-w-xl p-16 text-center">
          <h1 className="font-display text-3xl">Presente não encontrado</h1>
          <Button asChild className="mt-6">
            <Link to="/casamento/$slug" params={{ slug }}>
              Voltar para a lista
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!mpEnabled && phase === "form") {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Pagamento indisponível</CardTitle>
              <CardDescription>
                O pagamento online ainda não foi ativado pelo administrador do site.
                Entre em contato para finalizar este presente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/casamento/$slug" params={{ slug }}>Voltar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Tela Pix ----------
  if (phase === "pix" && pixData) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <QrCode className="size-5 text-accent" /> Pague com Pix
              </CardTitle>
              <CardDescription>
                Escaneie o QR Code ou copie o código e cole no app do seu banco.
                Assim que o pagamento cair, o presente é confirmado automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-secondary/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Valor</p>
                <p className="text-3xl font-medium text-primary">
                  {formatBRL(charge.totalCents)}
                </p>
              </div>

              {pixData.qrCodeBase64 ? (
                <div className="flex justify-center">
                  <img
                    src={pixData.qrCodeBase64}
                    alt="QR Code Pix"
                    className="h-64 w-64 rounded-lg border bg-white p-2"
                  />
                </div>
              ) : null}

              <div className="break-all rounded-lg border bg-card p-4 font-mono text-xs">
                {pixData.qrCode}
              </div>

              <Button
                className="w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(pixData.qrCode);
                  setCopied(true);
                  toast.success("Código Pix copiado!");
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copiar código Pix
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Aguardando confirmação do pagamento…
              </div>

              <Button asChild variant="outline" className="w-full">
                <Link to="/meus-presentes">Ver meus presentes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Tela Cartão (brick) ----------
  if (phase === "card" && cardOrderId) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <CreditCard className="size-5 text-accent" /> Pagar com cartão
              </CardTitle>
              <CardDescription>
                Preencha os dados do cartão com segurança. O processamento é feito
                pelo Mercado Pago.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-secondary/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-3xl font-medium text-primary">
                  {formatBRL(charge.totalCents)}
                </p>
                {method === "credit" && installments > 1 ? (
                  <p className="text-xs text-muted-foreground">
                    {installments}x de {formatBRL(charge.installmentCents)}
                  </p>
                ) : null}
              </div>

              <Suspense
                fallback={
                  <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                    Carregando pagamento por cartão…
                  </div>
                }
              >
                <MercadoPagoCardPayment
                  publicKey={mpPublicKey}
                  amount={charge.totalCents / 100}
                  onSubmit={submitCard}
                  onError={(m) => toast.error("Erro no cartão", { description: m })}
                />
              </Suspense>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setPhase("form");
                  setCardOrderId(null);
                }}
              >
                Voltar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Tela Resultado cartão ----------
  if (phase === "result" && cardResult) {
    const isPaid = cardResult.status === "paid";
    const isPending = cardResult.status === "pending";
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card text-center">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              {isPaid ? (
                <CheckCircle2 className="size-16 text-emerald-500" />
              ) : isPending ? (
                <Loader2 className="size-16 animate-spin text-primary" />
              ) : (
                <XCircle className="size-16 text-destructive" />
              )}
              <h2 className="font-display text-2xl">
                {isPaid
                  ? "Pagamento aprovado!"
                  : isPending
                    ? "Pagamento em processamento"
                    : "Pagamento recusado"}
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {isPaid
                  ? "Seu presente foi confirmado. Obrigado!"
                  : isPending
                    ? "Aguarde alguns instantes pela confirmação."
                    : cardResult.detail || "Tente novamente com outro cartão."}
              </p>
              <Button asChild>
                <Link to="/meus-presentes">Ver meus presentes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Formulário inicial ----------
  return (
    <div>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div>
            <Link
              to="/casamento/$slug/presentes"
              params={{ slug }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Voltar para a lista
            </Link>
            <h1 className="mt-3 font-display text-4xl">Finalizar presente</h1>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">Forma de pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["pix", "credit"] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMethod(m);
                      if (m !== "credit") setInstallments(1);
                    }}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      method === m
                        ? "border-primary bg-secondary"
                        : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    {m === "pix" ? (
                      <QrCode className="size-5 text-accent" />
                    ) : (
                      <CreditCard className="size-5 text-accent" />
                    )}
                    <p className="mt-2 text-sm font-medium">{PAYMENT_LABELS[m]}</p>
                    <p className="text-xs text-muted-foreground">
                      {m === "credit" ? "Até 12x com taxa" : "Aprovação imediata"}
                    </p>
                  </button>
                ))}
              </div>

              {method === "credit" ? (
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select
                    value={String(installments)}
                    onValueChange={(v) => setInstallments(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                        const c = computeCharge(gift.price_cents, "credit", n);
                        return (
                          <SelectItem key={n} value={String(n)}>
                            {n}x de {formatBRL(c.installmentCents)}
                            {n === 1 ? " (sem juros)" : ` · total ${formatBRL(c.totalCents)}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="msg">Recado para os noivos (opcional)</Label>
                <Textarea
                  id="msg"
                  maxLength={500}
                  value={messageToCouple}
                  onChange={(e) => setMessageToCouple(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card className="shadow-card sticky top-24">
            <CardHeader>
              <CardTitle className="text-xl">{gift.name}</CardTitle>
              <CardDescription>
                Presente para {wedding.bride_name} & {wedding.groom_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor do presente</span>
                <span>{formatBRL(gift.price_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa de parcelamento</span>
                <span>{charge.feeCents ? formatBRL(charge.feeCents) : "Isento"}</span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Total</span>
                <span className="text-2xl font-medium text-primary">
                  {formatBRL(charge.totalCents)}
                </span>
              </div>
              {method === "credit" && installments > 1 ? (
                <p className="text-xs text-muted-foreground">
                  {installments}x de {formatBRL(charge.installmentCents)}
                </p>
              ) : null}

              {method === "pix" ? (
                <Button
                  className="mt-4 w-full"
                  size="lg"
                  disabled={startPix.isPending || createOrder.isPending}
                  onClick={() => startPix.mutate()}
                >
                  {startPix.isPending ? "Gerando Pix..." : "Pagar com Pix"}
                </Button>
              ) : (
                <Button
                  className="mt-4 w-full"
                  size="lg"
                  disabled={startCard.isPending || createOrder.isPending}
                  onClick={() => startCard.mutate()}
                >
                  {startCard.isPending ? "Iniciando..." : "Pagar com cartão"}
                </Button>
              )}

              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4" />
                Pagamento processado pelo Mercado Pago. Seus dados ficam protegidos.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
