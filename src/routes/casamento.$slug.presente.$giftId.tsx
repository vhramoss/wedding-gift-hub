import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, CreditCard, QrCode, ShieldCheck } from "lucide-react";

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
  buildPixPayload,
  cardBrand,
  computeCharge,
  formatBRL,
  luhn,
  maskCPF,
  onlyDigits,
  PAYMENT_LABELS,
  type PaymentMethod,
} from "@/lib/br";

export const Route = createFileRoute("/casamento/$slug/presente/$giftId")({
  head: () => ({
    meta: [
      { title: "Presentear os noivos · Pagamento" },
      {
        name: "description",
        content:
          "Escolha a forma de pagamento — Pix, débito ou crédito parcelado — e finalize o presente.",
      },
      { property: "og:title", content: "Presentear os noivos · Pagamento" },
      {
        property: "og:description",
        content: "Finalize o presente com Pix, cartão de débito ou crédito parcelado.",
      },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { slug, giftId } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [messageToCouple, setMessageToCouple] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCpf, setCardCpf] = useState("");
  const [pixOrder, setPixOrder] = useState<{ payload: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!gift || !user) throw new Error("Sessão expirada.");
      if (method === "credit" || method === "debit") {
        if (!luhn(cardNumber)) throw new Error("Número do cartão inválido.");
        if (cardName.trim().length < 3) throw new Error("Informe o nome impresso no cartão.");
        if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) throw new Error("Validade no formato MM/AA.");
        if (onlyDigits(cardCvv).length < 3) throw new Error("CVV inválido.");
      }
      const status = method === "pix" ? "pending" : "paid";
      const { data, error } = await supabase
        .from("orders")
        .insert({
          wedding_id: gift.wedding_id,
          gift_id: gift.id,
          user_id: user.id,
          guest_name: profileQuery.data?.full_name ?? "",
          guest_cpf: profileQuery.data?.cpf ?? (onlyDigits(cardCpf) || null),
          payment_method: method,
          installments: method === "credit" ? installments : 1,
          amount_cents: gift.price_cents,
          fee_cents: charge.feeCents,
          total_cents: charge.totalCents,
          message: messageToCouple.trim() || null,
          status,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, status };
    },
    onSuccess: (result) => {
      if (result.status === "pending" && wedding?.pix_key) {
        setPixOrder({
          id: result.id,
          payload: buildPixPayload({
            key: wedding.pix_key,
            holder: wedding.pix_holder ?? `${wedding.bride_name} ${wedding.groom_name}`,
            amountCents: charge.totalCents,
            txid: result.id.replace(/-/g, "").slice(0, 25),
          }),
        });
        toast.success("Pedido criado! Pague com o código Pix abaixo.");
      } else if (result.status === "pending") {
        toast.warning("Pedido registrado, mas os noivos ainda não cadastraram a chave Pix.");
        navigate({ to: "/meus-presentes" });
      } else {
        toast.success("Pagamento aprovado. Obrigado pelo presente!");
        navigate({ to: "/meus-presentes" });
      }
    },
    onError: (e: Error) => toast.error("Não foi possível concluir", { description: e.message }),
  });

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

  if (pixOrder) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <QrCode className="size-5 text-accent" /> Pague com Pix
              </CardTitle>
              <CardDescription>
                Copie o código abaixo e cole no aplicativo do seu banco. Assim que o pagamento cair,
                os noivos confirmam o presente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-secondary/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Valor</p>
                <p className="text-3xl font-medium text-primary">
                  {formatBRL(charge.totalCents)}
                </p>
              </div>
              <div className="break-all rounded-lg border bg-card p-4 font-mono text-xs">
                {pixOrder.payload}
              </div>
              <Button
                className="w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(pixOrder.payload);
                  setCopied(true);
                  toast.success("Código Pix copiado!");
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copiar código Pix
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/meus-presentes">Ver meus presentes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              <div className="grid gap-3 sm:grid-cols-3">
                {(["pix", "debit", "credit"] as PaymentMethod[]).map((m) => (
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
                      {m === "credit" ? "Até 12x com taxa" : "Sem taxa"}
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

              {method !== "pix" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cardNumber">Número do cartão</Label>
                    <Input
                      id="cardNumber"
                      inputMode="numeric"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      maxLength={23}
                      onChange={(e) =>
                        setCardNumber(
                          onlyDigits(e.target.value)
                            .slice(0, 19)
                            .replace(/(\d{4})(?=\d)/g, "$1 "),
                        )
                      }
                    />
                    {cardNumber ? (
                      <p className="text-xs text-muted-foreground">{cardBrand(cardNumber)}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cardName">Nome impresso no cartão</Label>
                    <Input
                      id="cardName"
                      value={cardName}
                      maxLength={80}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardExpiry">Validade</Label>
                    <Input
                      id="cardExpiry"
                      placeholder="MM/AA"
                      value={cardExpiry}
                      maxLength={5}
                      onChange={(e) => {
                        const d = onlyDigits(e.target.value).slice(0, 4);
                        setCardExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardCvv">CVV</Label>
                    <Input
                      id="cardCvv"
                      inputMode="numeric"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(onlyDigits(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cardCpf">CPF do titular</Label>
                    <Input
                      id="cardCpf"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={cardCpf || maskCPF(profileQuery.data?.cpf ?? "")}
                      onChange={(e) => setCardCpf(maskCPF(e.target.value))}
                    />
                  </div>
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
              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={createOrder.isPending}
                onClick={() => createOrder.mutate()}
              >
                {createOrder.isPending ? "Processando..." : "Confirmar e pagar"}
              </Button>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4" />
                Os dados do cartão não são armazenados no banco de dados.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
