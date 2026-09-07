import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, PAYMENT_LABELS, type PaymentMethod } from "@/lib/br";

export const Route = createFileRoute("/casamento/$slug/obrigado")({
  head: () => ({
    meta: [
      { title: "Obrigado pelo presente · Casamento" },
      {
        name: "description",
        content:
          "Recibo do presente enviado aos noivos, com valor, forma de pagamento e data da confirmação.",
      },
      { property: "og:title", content: "Obrigado pelo presente" },
      {
        property: "og:description",
        content: "Seu presente foi registrado. Veja o recibo com valor e data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    pedido: typeof search["pedido"] === "string" ? (search["pedido"] as string) : "",
  }),
  component: ThankYouPage,
});

function ThankYouPage() {
  const { slug } = Route.useParams();
  const { pedido } = Route.useSearch();

  const orderQuery = useQuery({
    queryKey: ["order-receipt", pedido],
    enabled: Boolean(pedido),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, gifts(name), weddings(bride_name, groom_name)")
        .eq("id", pedido)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const order = orderQuery.data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 print:py-4">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-10 text-accent" />
        <h1 className="mt-4 font-display text-3xl sm:text-4xl">Obrigado pelo presente!</h1>
        <div className="divider-gold mx-auto my-6 w-32" />
        <p className="text-muted-foreground">
          Os noivos já foram avisados e vão receber seu carinho com muita alegria.
        </p>
      </div>

      <Card className="shadow-card mt-10">
        <CardHeader>
          <CardTitle className="text-xl">Recibo do presente</CardTitle>
          <CardDescription>Guarde este comprovante se quiser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {orderQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !order ? (
            <p className="text-muted-foreground">
              Não encontramos os detalhes deste presente. Veja tudo em “Meus presentes”.
            </p>
          ) : (
            <>
              <Row label="Presente" value={order.gifts?.name ?? "Presente"} />
              {order.shares > 1 ? <Row label="Cotas" value={`${order.shares} cota(s)`} /> : null}
              <Row
                label="Casal"
                value={`${order.weddings?.bride_name ?? ""} & ${order.weddings?.groom_name ?? ""}`}
              />
              <Row
                label="Forma de pagamento"
                value={`${PAYMENT_LABELS[order.payment_method as PaymentMethod]}${
                  order.installments > 1 ? ` em ${order.installments}x` : ""
                }`}
              />
              <Row label="Valor" value={formatBRL(order.total_cents)} />
              <Row
                label="Situação"
                value={
                  order.status === "paid"
                    ? "Pagamento confirmado"
                    : order.status === "pending"
                      ? "Aguardando confirmação"
                      : "Cancelado"
                }
              />
              <Row
                label="Data"
                value={new Date(order.paid_at ?? order.created_at).toLocaleString("pt-BR")}
              />
              {order.message ? <Row label="Seu recado" value={order.message} /> : null}
              <Separator />
              <p className="text-xs text-muted-foreground">Pedido {order.id}</p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir recibo
        </Button>
        <Button asChild variant="outline">
          <Link to="/casamento/$slug/presentes" params={{ slug }}>
            Ver a lista de presentes
          </Link>
        </Button>
        <Button asChild>
          <Link to="/meus-presentes">Meus presentes</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
