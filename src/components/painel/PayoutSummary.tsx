import { useQuery } from "@tanstack/react-query";
import { Banknote } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/br";

export function PayoutSummary({ weddingId }: { weddingId: string | null }) {
  const { data } = useQuery({
    queryKey: ["panel", "payout-summary", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wedding_payout_summary", {
        _wedding_id: weddingId!,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const payoutsQuery = useQuery({
    queryKey: ["panel", "payouts", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_payouts")
        .select("*")
        .eq("wedding_id", weddingId!)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const items = [
    { label: "Presentes recebidos", value: data?.gross_cents ?? 0 },
    { label: "Taxa da plataforma", value: data?.commission_cents ?? 0 },
    { label: "Já repassado a vocês", value: data?.paid_out_cents ?? 0 },
    { label: "A receber", value: data?.pending_cents ?? 0 },
  ];

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Banknote className="size-5 text-accent" /> Valores dos presentes
        </CardTitle>
        <CardDescription>
          Acompanhe quanto já entrou em presentes e quanto ainda será repassado para vocês.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg border bg-secondary/30 p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-xl font-medium text-primary">
                {formatBRL(Number(item.value))}
              </p>
            </div>
          ))}
        </div>

        {(payoutsQuery.data ?? []).length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Repasses já feitos</p>
            {(payoutsQuery.data ?? []).map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span>{new Date(p.paid_at).toLocaleDateString("pt-BR")}</span>
                <span className="text-muted-foreground">{p.notes ?? p.method}</span>
                <span className="font-medium text-primary">{formatBRL(p.amount_cents)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
