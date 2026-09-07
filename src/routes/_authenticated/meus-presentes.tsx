import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, PAYMENT_LABELS, type PaymentMethod } from "@/lib/br";

export const Route = createFileRoute("/_authenticated/meus-presentes")({
  head: () => ({
    meta: [
      { title: "Meus presentes · Nós Dois" },
      {
        name: "description",
        content: "Acompanhe os presentes escolhidos, o valor pago e a situação de cada pagamento.",
      },
      { property: "og:title", content: "Meus presentes · Nós Dois" },
      { property: "og:description", content: "Histórico dos presentes e pagamentos do convidado." },
    ],
  }),
  component: MyGifts,
});

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> =
  {
    paid: { label: "Pago", variant: "default" },
    pending: { label: "Aguardando pagamento", variant: "secondary" },
    cancelled: { label: "Cancelado", variant: "destructive" },
  };

function MyGifts() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("orders")
        .select("*, gifts(name), weddings(bride_name, groom_name, slug)")
        .eq("user_id", userData.user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-display text-4xl">Meus presentes</h1>
        <p className="mt-2 text-muted-foreground">
          Acompanhe aqui tudo o que você já presenteou.
        </p>

        <div className="mt-8 space-y-4">
          {isLoading ? (
            <>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </>
          ) : (data ?? []).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                Você ainda não escolheu nenhum presente.
                <div className="mt-4">
                  <Button asChild>
                    <Link to="/">Ver casamentos</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            (data ?? []).map((order) => (
              <Card key={order.id} className="shadow-card">
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl">{order.gifts?.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {order.weddings?.bride_name} & {order.weddings?.groom_name} ·{" "}
                      {PAYMENT_LABELS[order.payment_method as PaymentMethod]}
                      {order.installments > 1 ? ` em ${order.installments}x` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-medium text-primary">
                      {formatBRL(order.total_cents)}
                    </p>
                    <Badge variant={STATUS[order.status]?.variant ?? "secondary"}>
                      {STATUS[order.status]?.label ?? order.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
