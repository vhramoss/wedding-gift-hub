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
import { QRCodeSVG } from "qrcode.react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  PAYMENT_LABELS,
  type PaymentMethod,
} from "@/lib/br";
import {
  createPaymentOrder,
  createPixPayment,
  getMercadoPagoConfig,
  processCardPayment,
} from "@/lib/mercadopago.functions";

const MercadoPagoCardPayment = lazy(
  () => import("@/components/MercadoPagoCardPayment"),
);

export const Route = createFileRoute(
  "/casamento/$slug/presente/$giftId",
)({
  head: () => ({
    meta: [
      { title: "Presentear os noivos · Pagamento" },
      {
        name: "description",
        content:
          "Escolha a forma de pagamento — Pix, débito ou crédito — e finalize o presente com segurança.",
      },
      {
        property: "og:title",
        content: "Presentear os noivos · Pagamento",
      },
      {
        property: "og:description",
        content:
          "Finalize o presente com Pix, cartão de débito ou cartão de crédito.",
      },
    ],
  }),
  component: CheckoutPage,
});

type Phase = "form" | "pix" | "card" | "result";

type PayResult = {
  status: "paid" | "pending" | "cancelled";
  detail: string;
};

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  orderId: string;
};

function CheckoutPage() {
  const { slug, giftId } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [messageToCouple, setMessageToCouple] = useState("");
  const [phase, setPhase] = useState<Phase>("form");

  const [pixData, setPixData] = useState<PixData | null>(null);

  const [cardOrderId, setCardOrderId] = useState<string | null>(
    null,
  );

  const [cardResult, setCardResult] =
    useState<PayResult | null>(null);

  const [copied, setCopied] = useState(false);

  // ------------------------------------------------------------
  // Configuração pública do Mercado Pago
  // ------------------------------------------------------------

  const mpConfig = useQuery({
    queryKey: ["mp-config"],
    queryFn: () => getMercadoPagoConfig(),
  });

  const mpEnabled = Boolean(mpConfig.data?.enabled);
  const mpPublicKey = mpConfig.data?.publicKey ?? "";

  // ------------------------------------------------------------
  // Server functions
  // ------------------------------------------------------------

  const createOrderFn = useServerFn(createPaymentOrder);
  const createPix = useServerFn(createPixPayment);
  const processCard = useServerFn(processCardPayment);

  // ------------------------------------------------------------
  // Redireciona para login caso necessário
  // ------------------------------------------------------------

  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/auth",
        search: {
          redirect: `/casamento/${slug}/presente/${giftId}`,
        },
        replace: true,
      });
    }
  }, [loading, user, navigate, slug, giftId]);

  // ------------------------------------------------------------
  // Busca o presente
  // ------------------------------------------------------------

  const giftQuery = useQuery({
    queryKey: ["gift", giftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select(
          `
            *,
            weddings!inner(
              id,
              slug,
              bride_name,
              groom_name,
              pix_key,
              pix_holder
            )
          `,
        )
        .eq("id", giftId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const gift = giftQuery.data;
  const wedding = gift?.weddings;

  // ------------------------------------------------------------
  // Calcula visualmente o valor.
  //
  // IMPORTANTE:
  // Este cálculo é apenas para exibição.
  // O cálculo verdadeiro também acontece no servidor.
  // ------------------------------------------------------------

  const charge = useMemo(() => {
    return computeCharge(
      gift?.price_cents ?? 0,
      method,
      method === "credit" ? installments : 1,
    );
  }, [gift?.price_cents, method, installments]);

  // ------------------------------------------------------------
  // Criação segura do pedido
  //
  // O frontend NÃO envia:
  // - amount_cents
  // - fee_cents
  // - total_cents
  // - status
  //
  // O servidor busca o presente e calcula tudo novamente.
  // ------------------------------------------------------------

  const createOrder = useMutation({
    mutationFn: async (
      targetMethod: PaymentMethod,
    ): Promise<string> => {
      if (!gift || !user) {
        throw new Error("Sessão expirada.");
      }

      const result = await createOrderFn({
        data: {
          giftId: gift.id,
          paymentMethod: targetMethod,
          installments:
            targetMethod === "credit" ? installments : 1,
          message: messageToCouple.trim() || undefined,
        },
      });

      return result.orderId;
    },

    onError: (e: Error) => {
      toast.error("Não foi possível criar o pedido", {
        description: e.message,
      });
    },
  });

  // ============================================================
  // PIX
  // ============================================================

  const startPix = useMutation({
    mutationFn: async () => {
      const orderId = await createOrder.mutateAsync("pix");

      const result = await createPix({
        data: {
          orderId,
        },
      });

      return result;
    },

    onSuccess: (result) => {
      setPixData({
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64 ?? "",
        orderId: result.orderId,
      });

      setCopied(false);
      setPhase("pix");

      toast.success(
        "Pedido criado! Pague com o QR Code abaixo.",
      );
    },

    onError: (e: Error) => {
      toast.error("Falha ao gerar Pix", {
        description: e.message,
      });
    },
  });

  // ------------------------------------------------------------
  // Polling do Pix
  //
  // O frontend apenas OBSERVA o banco.
  // Ele nunca muda o pedido para paid.
  //
  // Quem muda para paid é o webhook/backend após confirmação
  // real do Mercado Pago.
  // ------------------------------------------------------------

  useEffect(() => {
    if (phase !== "pix" || !pixData?.orderId) {
      return;
    }

    let active = true;

    const check = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("status")
          .eq("id", pixData.orderId)
          .maybeSingle();

        if (error || !active || !data) {
          return;
        }

        if (data.status === "paid") {
          toast.success(
            "Pagamento confirmado! Obrigado pelo presente.",
          );

          navigate({
            to: "/meus-presentes",
          });
        }

        if (data.status === "cancelled") {
          toast.error(
            "Este pagamento foi cancelado.",
          );

          setPhase("form");
          setPixData(null);
        }
      } catch {
        // Não interrompe o polling por um erro temporário.
      }
    };

    const interval = setInterval(check, 5000);

    check();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [phase, pixData?.orderId, navigate]);

  // ============================================================
  // CARTÃO
  // ============================================================

  const startCard = useMutation({
    mutationFn: async () => {
      if (
        method !== "credit" &&
        method !== "debit"
      ) {
        throw new Error(
          "Selecione um método de pagamento por cartão.",
        );
      }

      const orderId = await createOrder.mutateAsync(
        method,
      );

      return orderId;
    },

    onSuccess: (orderId) => {
      setCardOrderId(orderId);
      setCardResult(null);
      setPhase("card");
    },

    onError: (e: Error) => {
      toast.error(
        "Não foi possível iniciar o pagamento",
        {
          description: e.message,
        },
      );
    },
  });

  // ------------------------------------------------------------
  // Envia o token do cartão ao servidor.
  //
  // O número/CVV não são armazenados no site.
  // ------------------------------------------------------------

  const submitCard = async (cardData: {
    token: string;
    paymentMethodId: string;
    issuerId?: string;
    installments: number;
  }) => {
    if (!cardOrderId) {
      toast.error("Pedido não encontrado.");
      return;
    }

    if (
      method !== "credit" &&
      method !== "debit"
    ) {
      toast.error("Método de cartão inválido.");
      return;
    }

    try {
      const result = await processCard({
        data: {
          orderId: cardOrderId,
          token: cardData.token,
          paymentMethodId: cardData.paymentMethodId,
          issuerId: cardData.issuerId ?? "",
          installments:
            method === "debit"
              ? 1
              : cardData.installments,
        },
      });

      setCardResult({
        status: result.status,
        detail: result.detail,
      });

      setPhase("result");

      if (result.status === "paid") {
        toast.success(
          "Pagamento aprovado. Obrigado pelo presente!",
        );

        setTimeout(() => {
          navigate({
            to: "/meus-presentes",
          });
        }, 2500);
      } else if (result.status === "cancelled") {
        toast.error("Pagamento recusado.");
      } else {
        toast.warning(
          "Pagamento em processamento. Aguarde a confirmação.",
        );
      }
    } catch (e) {
      toast.error("Falha no pagamento", {
        description:
          e instanceof Error
            ? e.message
            : "Não foi possível processar o pagamento.",
      });

      setCardResult({
        status: "cancelled",
        detail:
          e instanceof Error
            ? e.message
            : "Erro ao processar pagamento.",
      });

      setPhase("result");
    }
  };

  // ------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // Presente não encontrado
  // ------------------------------------------------------------

  if (!gift || !wedding) {
    return (
      <div>
        <div className="mx-auto max-w-xl p-16 text-center">
          <h1 className="font-display text-3xl">
            Presente não encontrado
          </h1>

          <Button
            asChild
            className="mt-6"
          >
            <Link
              to="/casamento/$slug"
              params={{ slug }}
            >
              Voltar para a lista
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Mercado Pago indisponível
  // ------------------------------------------------------------

  if (
    !mpConfig.isLoading &&
    !mpEnabled &&
    phase === "form"
  ) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                Pagamento indisponível
              </CardTitle>

              <CardDescription>
                O pagamento online ainda não foi ativado pelo
                administrador do site. Entre em contato para
                finalizar este presente.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Button
                asChild
                variant="outline"
              >
                <Link
                  to="/casamento/$slug"
                  params={{ slug }}
                >
                  Voltar
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA PIX
  // ============================================================

  if (phase === "pix" && pixData) {
    const base64Src =
      pixData.qrCodeBase64
        ? pixData.qrCodeBase64.startsWith("data:")
          ? pixData.qrCodeBase64
          : `data:image/png;base64,${pixData.qrCodeBase64}`
        : "";

    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <QrCode className="size-5 text-accent" />
                Pague com Pix
              </CardTitle>

              <CardDescription>
                Escaneie o QR Code ou copie o código e cole no
                aplicativo do seu banco. Assim que o pagamento
                for confirmado pelo Mercado Pago, o presente será
                confirmado automaticamente.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-secondary/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Valor
                </p>

                <p className="text-3xl font-medium text-primary">
                  {formatBRL(charge.totalCents)}
                </p>
              </div>

              {/* 
                Primeiro tenta usar o QR Code Base64 retornado pelo MP.
                Caso não exista, gera um QR Code localmente a partir
                do código Pix copia e cola.
              */}

              {base64Src ? (
                <div className="flex justify-center">
                  <img
                    src={base64Src}
                    alt="QR Code Pix"
                    className="h-64 w-64 rounded-lg border bg-white p-2"
                  />
                </div>
              ) : pixData.qrCode ? (
                <div className="flex justify-center rounded-lg border bg-white p-4">
                  <QRCodeSVG
                    value={pixData.qrCode}
                    size={256}
                    level="M"
                    includeMargin
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
                  Não foi possível gerar o QR Code. Tente criar o
                  pagamento novamente.
                </div>
              )}

              {pixData.qrCode ? (
                <>
                  <div className="break-all rounded-lg border bg-card p-4 font-mono text-xs">
                    {pixData.qrCode}
                  </div>

                  <Button
                    className="w-full"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          pixData.qrCode,
                        );

                        setCopied(true);

                        toast.success(
                          "Código Pix copiado!",
                        );
                      } catch {
                        toast.error(
                          "Não foi possível copiar o código.",
                        );
                      }
                    }}
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}

                    {copied
                      ? "Código Pix copiado"
                      : "Copiar código Pix"}
                  </Button>
                </>
              ) : null}

              <div className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />

                <span>
                  Aguardando confirmação do pagamento…
                </span>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                O presente será marcado como pago somente após a
                confirmação real do Mercado Pago.
              </p>

              <Button
                asChild
                variant="outline"
                className="w-full"
              >
                <Link to="/meus-presentes">
                  Ver meus presentes
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA DO CARTÃO
  // ============================================================

  if (phase === "card" && cardOrderId) {
    const cardMethod =
      method === "debit" ? "debit" : "credit";

    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <CreditCard className="size-5 text-accent" />

                {cardMethod === "debit"
                  ? "Pagar com cartão de débito"
                  : "Pagar com cartão de crédito"}
              </CardTitle>

              <CardDescription>
                Preencha os dados do cartão com segurança. Os dados
                sensíveis são tokenizados pelo Mercado Pago e não
                são armazenados pelo site.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-secondary/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Total
                </p>

                <p className="text-3xl font-medium text-primary">
                  {formatBRL(charge.totalCents)}
                </p>

                {cardMethod === "credit" &&
                installments > 1 ? (
                  <p className="text-xs text-muted-foreground">
                    {installments}x de{" "}
                    {formatBRL(
                      charge.installmentCents,
                    )}
                  </p>
                ) : null}

                {cardMethod === "debit" ? (
                  <p className="text-xs text-muted-foreground">
                    Pagamento à vista
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
                  paymentMethod={cardMethod}
                  onSubmit={submitCard}
                  onError={(message) => {
                    toast.error("Erro no cartão", {
                      description: message,
                    });
                  }}
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

  // ============================================================
  // RESULTADO DO CARTÃO
  // ============================================================

  if (phase === "result" && cardResult) {
    const isPaid = cardResult.status === "paid";
    const isPending =
      cardResult.status === "pending";

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
                    ? "O pagamento ainda está sendo confirmado. O presente só será considerado pago após a confirmação do Mercado Pago."
                    : cardResult.detail ||
                      "Tente novamente com outro cartão."}
              </p>

              {isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Aguardando atualização…
                </div>
              ) : null}

              <Button asChild>
                <Link to="/meus-presentes">
                  Ver meus presentes
                </Link>
              </Button>

              {!isPaid && !isPending ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCardResult(null);
                    setCardOrderId(null);
                    setPhase("form");
                  }}
                >
                  Tentar novamente
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================================
  // FORMULÁRIO INICIAL
  // ============================================================

  return (
    <div>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[1fr_360px]">
        {/* ----------------------------------------------------
            COLUNA ESQUERDA
        ---------------------------------------------------- */}

        <div className="space-y-6">
          <div>
            <Link
              to="/casamento/$slug/presentes"
              params={{ slug }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Voltar para a lista
            </Link>

            <h1 className="mt-3 font-display text-4xl">
              Finalizar presente
            </h1>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">
                Forma de pagamento
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* ------------------------------------------------
                  PIX / DÉBITO / CRÉDITO
              ------------------------------------------------ */}

              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    "pix",
                    "debit",
                    "credit",
                  ] as PaymentMethod[]
                ).map((paymentMethod) => (
                  <button
                    key={paymentMethod}
                    type="button"
                    onClick={() => {
                      setMethod(paymentMethod);

                      if (
                        paymentMethod !== "credit"
                      ) {
                        setInstallments(1);
                      }
                    }}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      method === paymentMethod
                        ? "border-primary bg-secondary"
                        : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    {paymentMethod === "pix" ? (
                      <QrCode className="size-5 text-accent" />
                    ) : (
                      <CreditCard className="size-5 text-accent" />
                    )}

                    <p className="mt-2 text-sm font-medium">
                      {PAYMENT_LABELS[paymentMethod]}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {paymentMethod === "pix"
                        ? "Aprovação após confirmação"
                        : paymentMethod === "debit"
                          ? "Pagamento à vista"
                          : "Até 12x com taxa"}
                    </p>
                  </button>
                ))}
              </div>

              {/* ------------------------------------------------
                  PARCELAS
                  Somente crédito
              ------------------------------------------------ */}

              {method === "credit" ? (
                <div className="space-y-2">
                  <Label>Parcelas</Label>

                  <Select
                    value={String(installments)}
                    onValueChange={(value) => {
                      setInstallments(Number(value));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {Array.from(
                        { length: 12 },
                        (_, index) => index + 1,
                      ).map((numberOfInstallments) => {
                        const installmentCharge =
                          computeCharge(
                            gift.price_cents,
                            "credit",
                            numberOfInstallments,
                          );

                        return (
                          <SelectItem
                            key={numberOfInstallments}
                            value={String(
                              numberOfInstallments,
                            )}
                          >
                            {numberOfInstallments}x de{" "}
                            {formatBRL(
                              installmentCharge.installmentCents,
                            )}
                            {numberOfInstallments === 1
                              ? " (sem juros)"
                              : ` · total ${formatBRL(
                                  installmentCharge.totalCents,
                                )}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {/* ------------------------------------------------
                  RECADO
              ------------------------------------------------ */}

              <div className="space-y-2">
                <Label htmlFor="msg">
                  Recado para os noivos (opcional)
                </Label>

                <Textarea
                  id="msg"
                  maxLength={500}
                  value={messageToCouple}
                  onChange={(event) => {
                    setMessageToCouple(
                      event.target.value,
                    );
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------
            RESUMO DO PEDIDO
        ---------------------------------------------------- */}

        <aside>
          <Card className="sticky top-24 shadow-card">
            <CardHeader>
              <CardTitle className="text-xl">
                {gift.name}
              </CardTitle>

              <CardDescription>
                Presente para {wedding.bride_name} &{" "}
                {wedding.groom_name}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Valor do presente
                </span>

                <span>
                  {formatBRL(gift.price_cents)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Taxa de parcelamento
                </span>

                <span>
                  {charge.feeCents
                    ? formatBRL(charge.feeCents)
                    : "Isento"}
                </span>
              </div>

              <Separator />

              <div className="flex items-baseline justify-between">
                <span className="font-medium">
                  Total
                </span>

                <span className="text-2xl font-medium text-primary">
                  {formatBRL(charge.totalCents)}
                </span>
              </div>

              {method === "credit" &&
              installments > 1 ? (
                <p className="text-xs text-muted-foreground">
                  {installments}x de{" "}
                  {formatBRL(
                    charge.installmentCents,
                  )}
                </p>
              ) : null}

              {method === "debit" ? (
                <p className="text-xs text-muted-foreground">
                  Pagamento à vista no cartão de débito
                </p>
              ) : null}

              {/* --------------------------------------------
                  BOTÃO PIX
              -------------------------------------------- */}

              {method === "pix" ? (
                <Button
                  className="mt-4 w-full"
                  size="lg"
                  disabled={
                    startPix.isPending ||
                    createOrder.isPending ||
                    mpConfig.isLoading
                  }
                  onClick={() => {
                    startPix.mutate();
                  }}
                >
                  {startPix.isPending ||
                  createOrder.isPending
                    ? "Gerando Pix..."
                    : "Pagar com Pix"}
                </Button>
              ) : (
                /* --------------------------------------------
                    BOTÃO DÉBITO / CRÉDITO
                -------------------------------------------- */
                <Button
                  className="mt-4 w-full"
                  size="lg"
                  disabled={
                    startCard.isPending ||
                    createOrder.isPending ||
                    mpConfig.isLoading
                  }
                  onClick={() => {
                    startCard.mutate();
                  }}
                >
                  {startCard.isPending ||
                  createOrder.isPending
                    ? "Iniciando..."
                    : method === "debit"
                      ? "Pagar com débito"
                      : "Pagar com cartão"}
                </Button>
              )}

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />

                <span>
                  Pagamento processado pelo Mercado Pago. O presente
                  só é marcado como pago após a confirmação do
                  pagamento.
                </span>
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}