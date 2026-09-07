import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/br";

function toCents(value: string) {
  const n = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function PayoutsTab() {
  const queryClient = useQueryClient();
  const [weddingId, setWeddingId] = useState<string>("");

  const weddingsQuery = useQuery({
    queryKey: ["admin", "weddings-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("id, bride_name, groom_name, slug")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selected = weddingId || weddingsQuery.data?.[0]?.id || "";

  const summaryQuery = useQuery({
    queryKey: ["admin", "payout-summary", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wedding_payout_summary", {
        _wedding_id: selected,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const payoutsQuery = useQuery({
    queryKey: ["admin", "payouts", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_payouts")
        .select("*")
        .eq("wedding_id", selected)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addPayout = useMutation({
    mutationFn: async (form: FormData) => {
      const amount = toCents(String(form.get("amount") ?? ""));
      if (amount <= 0) throw new Error("Informe um valor válido (ex.: 1.200,00).");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("wedding_payouts").insert({
        wedding_id: selected,
        amount_cents: amount,
        method: String(form.get("method") ?? "pix"),
        notes: String(form.get("notes") ?? "").trim() || null,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Repasse registrado.");
      queryClient.invalidateQueries({ queryKey: ["admin", "payouts", selected] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payout-summary", selected] });
    },
    onError: (e: Error) => toast.error("Erro ao registrar", { description: e.message }),
  });

  const removePayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_payouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Repasse removido.");
      queryClient.invalidateQueries({ queryKey: ["admin", "payouts", selected] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payout-summary", selected] });
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  if (weddingsQuery.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Banknote className="size-5 text-accent" /> Repasse aos noivos
          </CardTitle>
          <CardDescription>
            Escolha o casamento para ver quanto entrou, quanto é sua comissão e quanto ainda falta
            repassar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2">
            <Label>Casamento</Label>
            <Select value={selected} onValueChange={setWeddingId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(weddingsQuery.data ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.bride_name} & {w.groom_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total recebido", value: summary?.gross_cents ?? 0 },
              { label: "Sua comissão", value: summary?.commission_cents ?? 0 },
              { label: "Já repassado", value: summary?.paid_out_cents ?? 0 },
              { label: "Falta repassar", value: summary?.pending_cents ?? 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-xl font-medium text-primary">
                  {formatBRL(Number(item.value))}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Registrar um repasse</CardTitle>
          <CardDescription>Anote cada valor enviado para a conta dos noivos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={(e) => {
              const el = e.currentTarget;
              e.preventDefault();
              addPayout.mutate(new FormData(el), { onSuccess: () => el.reset() });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input id="amount" name="amount" placeholder="1.200,00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Forma</Label>
              <Input id="method" name="method" defaultValue="pix" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observação</Label>
              <Input id="notes" name="notes" placeholder="Comprovante, data..." />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={addPayout.isPending || !selected}>
                Registrar repasse
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(payoutsQuery.data ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-primary">{formatBRL(p.amount_cents)}</p>
                <p className="text-sm text-muted-foreground">
                  {p.method} · {new Date(p.paid_at).toLocaleDateString("pt-BR")}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover repasse"
                onClick={() => removePayout.mutate(p.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {(payoutsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum repasse registrado ainda.</p>
        ) : null}
      </div>
    </div>
  );
}
