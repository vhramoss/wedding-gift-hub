import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/br";

/** Faixas de taxa por valor do presente, definidas pelo super admin em cada casamento. */
export function FeeTiersCard({ weddingId }: { weddingId: string }) {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState("500");
  const [percent, setPercent] = useState("6");

  const tiers = useQuery({
    queryKey: ["admin", "fee-tiers", weddingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_fee_tiers")
        .select("id, up_to_cents, percent")
        .eq("wedding_id", weddingId)
        .order("up_to_cents", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin", "fee-tiers", weddingId] });

  const add = useMutation({
    mutationFn: async () => {
      const value = limit.trim() === "" ? null : Math.round(Number(limit.replace(",", ".")) * 100);
      const pct = Number(percent.replace(",", ".")) || 0;
      if (value !== null && (!Number.isFinite(value) || value <= 0)) {
        throw new Error("Informe um valor limite válido.");
      }
      const { error } = await supabase
        .from("wedding_fee_tiers")
        .insert({ wedding_id: weddingId, up_to_cents: value, percent: pct });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Faixa criada.");
      setLimit("");
      invalidate();
    },
    onError: (e: Error) => toast.error("Não deu para criar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_fee_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Faixa removida.");
      invalidate();
    },
    onError: (e: Error) => toast.error("Não deu para remover", { description: e.message }),
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Taxa por faixa de valor</CardTitle>
        <CardDescription>
          Ex.: presentes até R$ 500 com 6% e acima disso 4,5%. Deixe o valor limite em branco para
          criar a faixa “acima de tudo”. Sem faixas, vale a porcentagem geral do casamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {(tiers.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma faixa criada.</p>
          ) : null}
          {(tiers.data ?? []).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span>
                {t.up_to_cents === null
                  ? "Acima das faixas anteriores"
                  : `Até ${formatBRL(t.up_to_cents)}`}{" "}
                — <strong>{Number(t.percent)}%</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove.mutate(t.id)}
                disabled={remove.isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor={`tier-limit-${weddingId}`}>Até o valor (R$)</Label>
            <Input
              id={`tier-limit-${weddingId}`}
              value={limit}
              placeholder="500 (vazio = acima de tudo)"
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`tier-pct-${weddingId}`}>Taxa (%)</Label>
            <Input
              id={`tier-pct-${weddingId}`}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            <Plus className="size-4" /> Adicionar faixa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
