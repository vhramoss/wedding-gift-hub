import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Gift,
  Loader2,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/useSession";
import { useWedding } from "@/hooks/useWedding";
import { giftQuoteKey, useGiftQuotes } from "@/hooks/useGiftQuotes";
import { useCart } from "@/lib/cart";
import { computeCharge, formatBRL, PAYMENT_LABELS, type PaymentMethod } from "@/lib/br";
import {
  createCartOrder,
  createPixPayment,
  getMercadoPagoConfig,
  processCardPayment,
} from "@/lib/mercadopago.functions";

const MercadoPagoCardPayment = lazy(() => import("@/components/MercadoPagoCardPayment"));

export const Route = createFileRoute("/casamento/$slug/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho de presentes · Casamento" },
      {
        name: "description",
        content:
          "Junte vários presentes em um único pagamento por Pix, débito ou crédito em até 12x.",
      },
      { property: "og:title", content: "Carrinho de presentes · Casamento" },
      { property: "og:description", content: "Presenteie o casal com vários itens de uma vez." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CartPage,
});

type Phase = "form" | "pix" | "card" | "result";

const METHODS: { id: PaymentMethod; hint: string }[] = [
  { id: "pix", hint: "Aprovação imediata, sem taxa" },
  { id: "debit", hint: "À vista, sem taxa" },
  { id: "credit", hint: "Até 12x (com juros a partir de 2x)" },
];

function CartPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: wedding } = useWedding(slug);
  const cart = useCart();

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [messageToCouple, setMessageToCouple] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [copied, setCopied] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeBase64: string;
    orderId: string;
    totalCents: number;
  } | null>(null);
  const [cardOrder, setCardOrder] = useState<{ id: string; totalCents: number } | null>(null);
  const [cardResult, setCardResult] = useState<{
    status: "paid" | "pending" | "cancelled";
    detail: string;
  } | null>(null);

  const newCartOrder = useServerFn(createCartOrder);
  const createPix = useServerFn(createPixPayment);
  const processCard = useServerFn(processCardPayment);

  const mpConfig = useQuery({
    queryKey: ["mp-config", wedding?.id ?? null],
    enabled: Boolean(wedding?.id),
    queryFn: () => getMercadoPagoConfig({ data: { weddingId: wedding!.id } }),
    retry: 1,
  });

  const quoteItems = cart.items.map((item) => ({ giftId: item.giftId, shares: item.shares }));
  const quotesQuery = useGiftQuotes(quoteItems);
  const quotedItems = cart.items.map((item) => ({
    ...item,
    totalCents:
      quotesQuery.data?.get(giftQuoteKey(item.giftId, item.shares))?.total_cents ??
      item.unitCents * item.shares,
  }));
  const chargeBase = quotedItems.reduce((sum, item) => sum + item.totalCents, 0);
  const charge = useMemo(
    () => computeCharge(chargeBase, method, installments),
    [chargeBase, method, installments],
  );

  const guestReady = Boolean(user) || (guestName.trim().length >= 3 && /.+@.+\..+/.test(guestEmail));
  const guestData = user
    ? {}
    : {
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
      };
  const items = cart.items.map((i) => ({ giftId: i.giftId, shares: i.shares }));

  const startPix = useMutation({
    mutationFn: async () => {
      const order = await newCartOrder({
        data: {
          items,
          method: "pix",
          installments: 1,
          message: messageToCouple,
          ...guestData,
        },
      });
      const res = await createPix({
        data: { orderId: order.orderId, payerEmail: guestEmail.trim() },
      });
      return { orderId: order.orderId, ...res };
    },
    onSuccess: (res) => {
      setPixData({
        qrCode: res.qrCode,
        qrCodeBase64: res.qrCodeBase64,
        orderId: res.orderId,
        totalCents: res.totalCents,
      });
      setPhase("pix");
      toast.success("Pedido criado! Pague com o QR Code abaixo.");
    },
    onError: (e: Error) => toast.error("Falha ao gerar Pix", { description: e.message }),
  });

  const startCard = useMutation({
    mutationFn: () =>
      newCartOrder({
        data: {
          items,
          method,
          installments: method === "credit" ? installments : 1,
          message: messageToCouple,
          ...guestData,
        },
      }),
    onSuccess: (order) => {
      setCardOrder({ id: order.orderId, totalCents: order.totalCents });
      setPhase("card");
    },
    onError: (e: Error) =>
      toast.error("Não foi possível iniciar o pagamento", { description: e.message }),
  });

  // Confirmação do Pix
  useEffect(() => {
    if (phase !== "pix" || !pixData?.orderId) return;
    let active = true;
    const check = async () => {
      const { data } = await supabase.rpc("public_order_status", { p_order_id: pixData.orderId });
      const row = (data ?? [])[0];
      if (active && row?.status === "paid") {
        cart.clear();
        toast.success("Pagamento confirmado! Obrigado pelos presentes.");
        navigate({
          to: "/casamento/$slug/obrigado",
          params: { slug },
          search: { pedido: pixData.orderId },
        });
      }
    };
    const interval = setInterval(check, 5000);
    void check();
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [phase, pixData, navigate, slug, cart]);

  const submitCard = async (cardData: {
    token: string;
    paymentMethodId: string;
    issuerId?: string;
    installments: number;
  }) => {
    if (!cardOrder) return;
    try {
      const res = await processCard({
        data: { orderId: cardOrder.id, ...cardData, payerEmail: guestEmail.trim() },
      });
      setCardResult({ status: res.status, detail: res.detail });
      setPhase("result");
      if (res.status === "paid") {
        cart.clear();
        toast.success("Pagamento aprovado. Obrigado pelos presentes!");
        setTimeout(
          () =>
            navigate({
              to: "/casamento/$slug/obrigado",
              params: { slug },
              search: { pedido: cardOrder.id },
            }),
          2000,
        );
      } else if (res.status === "cancelled") {
        toast.error("Pagamento recusado.");
      }
    } catch (e) {
      toast.error("Falha no pagamento", {
        description: e instanceof Error ? e.message : undefined,
      });
      setCardResult({ status: "cancelled", detail: "Erro ao processar" });
      setPhase("result");
    }
  };

  // ---------- Pix ----------
  if (phase === "pix" && pixData) {
    return (
      <div className="payment-ui mx-auto max-w-xl px-4 py-16">
        <Card className="shadow-card text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Pague com Pix</CardTitle>
            <CardDescription>
              Total {formatBRL(pixData.totalCents)} — a confirmação é automática.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {pixData.qrCodeBase64 ? (
              <img
                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code Pix"
                className="size-56"
              />
            ) : (
              <QRCodeCanvas value={pixData.qrCode} size={224} />
            )}
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(pixData.qrCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copiar código Pix
            </Button>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Aguardando o pagamento…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Cartão ----------
  if (phase === "card" && cardOrder) {
    return (
      <div className="payment-ui mx-auto max-w-xl px-4 py-16">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-2xl">Dados do cartão</CardTitle>
            <CardDescription>Total {formatBRL(cardOrder.totalCents)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense
              fallback={
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  Carregando pagamento por cartão…
                </div>
              }
            >
              <MercadoPagoCardPayment
                publicKey={mpConfig.data?.publicKey ?? ""}
                amount={cardOrder.totalCents / 100}
                maxInstallments={method === "credit" ? installments : 1}
                onSubmit={submitCard}
                onError={(m) => toast.error("Erro no cartão", { description: m })}
              />
            </Suspense>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setPhase("form");
                setCardOrder(null);
              }}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Resultado ----------
  if (phase === "result" && cardResult) {
    const isPaid = cardResult.status === "paid";
    const isPending = cardResult.status === "pending";
    return (
      <div className="payment-ui mx-auto max-w-2xl px-4 py-16">
        <Card className="shadow-card text-center">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            {isPaid ? (
              <CheckCircle2 className="size-16 text-emerald-500" />
            ) : isPending ? (
              <Loader2 className="size-16 animate-spin text-primary" />
            ) : (
              <XCircle className="size-16 text-destructive" />
            )}
            <h2 className="text-2xl font-semibold">
              {isPaid
                ? "Pagamento aprovado!"
                : isPending
                  ? "Pagamento em processamento"
                  : "Pagamento recusado"}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {isPaid
                ? "Seus presentes foram confirmados. Obrigado!"
                : isPending
                  ? "Aguarde alguns instantes pela confirmação."
                  : cardResult.detail || "Tente novamente com outro cartão."}
            </p>
            <Button asChild variant="outline">
              <Link to="/casamento/$slug/presentes" params={{ slug }}>
                Voltar para a lista
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Carrinho vazio ----------
  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <ShoppingBag className="mx-auto size-8 text-accent" />
        <h1 className="mt-4 font-display text-3xl">Seu carrinho está vazio</h1>
        <p className="mt-2 text-muted-foreground">
          Escolha um ou mais presentes na lista e finalize tudo em um único pagamento.
        </p>
        <Button asChild className="mt-6">
          <Link to="/casamento/$slug/presentes" params={{ slug }}>
            Ver a lista de presentes
          </Link>
        </Button>
      </div>
    );
  }

  // ---------- Carrinho ----------
  return (
    <div className="payment-ui mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:gap-8 sm:py-12 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <Link
            to="/casamento/$slug/presentes"
            params={{ slug }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Continuar escolhendo presentes
          </Link>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Seu carrinho</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="divide-y p-0">
            {quotedItems.map((item) => (
              <div key={item.giftId} className="flex items-center gap-4 p-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-md bg-secondary/60">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="size-16 object-cover" />
                  ) : (
                    <div className="flex size-16 items-center justify-center">
                      <Gift className="size-5 text-accent" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.isShared
                      ? `${formatBRL(Math.round(item.totalCents / item.shares))} por cota`
                      : formatBRL(item.totalCents)}
                  </p>
                  {item.isShared ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7"
                        onClick={() => cart.setShares(item.giftId, item.shares - 1)}
                        disabled={item.shares <= 1}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-16 text-center text-sm">
                        {item.shares} cota{item.shares > 1 ? "s" : ""}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7"
                        onClick={() => cart.setShares(item.giftId, item.shares + 1)}
                        disabled={item.shares >= item.maxShares}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatBRL(item.totalCents)}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 text-muted-foreground"
                    onClick={() => cart.remove(item.giftId)}
                  >
                    <Trash2 className="size-4" /> Remover
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMethod(m.id);
                    if (m.id !== "credit") setInstallments(1);
                  }}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    method === m.id
                      ? "border-primary bg-secondary"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  {m.id === "pix" ? (
                    <QrCode className="size-5 text-accent" />
                  ) : m.id === "debit" ? (
                    <Wallet className="size-5 text-accent" />
                  ) : (
                    <CreditCard className="size-5 text-accent" />
                  )}
                  <p className="mt-2 text-sm font-medium">{PAYMENT_LABELS[m.id]}</p>
                  <p className="text-xs text-muted-foreground">{m.hint}</p>
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
                      const c = computeCharge(chargeBase, "credit", n);
                      return (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de {formatBRL(c.installmentCents)}
                          {n === 1 ? " (sem juros)" : ` — total ${formatBRL(c.totalCents)}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {!user ? (
              <div className="space-y-4 rounded-lg border border-border/60 p-4">
                <p className="text-sm text-muted-foreground">
                  Você não precisa criar conta. Só informe seus dados para os noivos saberem quem
                  presenteou.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cart-name">Seu nome</Label>
                  <Input
                    id="cart-name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cart-email">E-mail</Label>
                    <Input
                      id="cart-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="voce@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cart-phone">Celular (opcional)</Label>
                    <Input
                      id="cart-phone"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="cart-msg">Recado para os noivos (opcional)</Label>
              <Textarea
                id="cart-msg"
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
            <CardTitle className="text-xl">Resumo</CardTitle>
            <CardDescription>
              {cart.items.length} presente{cart.items.length > 1 ? "s" : ""} escolhido
              {cart.items.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {quotedItems.map((i) => (
              <div key={i.giftId} className="flex justify-between gap-3">
                <span className="truncate text-muted-foreground">
                  {i.name}
                  {i.isShared ? ` (${i.shares}x)` : ""}
                </span>
                <span>{formatBRL(i.totalCents)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Presentes</span>
              <span>{formatBRL(chargeBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa de parcelamento</span>
              <span>
                {charge.totalCents - chargeBase
                  ? formatBRL(charge.totalCents - chargeBase)
                  : "Isento"}
              </span>
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

            <Button
              className="mt-2 w-full"
              disabled={
                !guestReady ||
                !mpConfig.data?.enabled ||
                startPix.isPending ||
                startCard.isPending
              }
              onClick={() => (method === "pix" ? startPix.mutate() : startCard.mutate())}
            >
              {startPix.isPending || startCard.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {method === "pix" ? "Gerar Pix" : "Pagar com cartão"}
            </Button>
            {!guestReady ? (
              <p className="text-xs text-muted-foreground">
                Informe seu nome e e-mail para continuar.
              </p>
            ) : null}
            {mpConfig.data && !mpConfig.data.enabled ? (
              <p className="text-xs text-destructive">
                O pagamento online ainda não está disponível neste site.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
