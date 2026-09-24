import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/br";

/** Cerimonialista do casamento: recebe uma % sobre a comissão (lucro) da plataforma. */
export function PlannerCard({ weddingId }: { weddingId: string }) {
  const qc = useQueryClient();
  const key = ["admin", "planner", weddingId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("planner_name, planner_contact, planner_pix, planner_percent")
        .eq("id", weddingId)
        .single();
      if (error) throw error;
      const { data: orders } = await supabase
        .from("orders")
        .select("planner_cents, commission_cents")
        .eq("wedding_id", weddingId)
        .eq("status", "paid");
      const planner = (orders ?? []).reduce((s, o) => s + (o.planner_cents ?? 0), 0);
      const comm = (orders ?? []).reduce((s, o) => s + (o.commission_cents ?? 0), 0);
      return { ...data, planner, comm };
    },
  });

  const [form, setForm] = useState({ name: "", contact: "", pix: "", percent: "0" });
  useEffect(() => {
    if (q.data)
      setForm({
        name: q.data.planner_name ?? "",
        contact: q.data.planner_contact ?? "",
        pix: q.data.planner_pix ?? "",
        percent: String(q.data.planner_percent ?? 0),
      });
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const pct = Math.min(100, Math.max(0, Number(form.percent.replace(",", ".")) || 0));
      const { error } = await supabase
        .from("weddings")
        .update({
          planner_name: form.name.trim() || null,
          planner_contact: form.contact.trim() || null,
          planner_pix: form.pix.trim() || null,
          planner_percent: pct,
        })
        .eq("id", weddingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cerimonialista salvo.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error("Não deu para salvar", { description: e.message }),
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Cerimonialista</CardTitle>
        <CardDescription>
          A porcentagem é calculada sobre a sua comissão (o que você lucra) em cada presente pago.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>WhatsApp / e-mail</Label>
            <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Chave Pix</Label>
            <Input value={form.pix} onChange={(e) => setForm({ ...form, pix: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>% sobre a sua comissão</Label>
            <Input value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Sua comissão até agora: <strong>{formatBRL(q.data?.comm ?? 0)}</strong> · A repassar ao
          cerimonialista: <strong>{formatBRL(q.data?.planner ?? 0)}</strong>
        </p>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Salvar cerimonialista
        </Button>
      </CardContent>
    </Card>
  );
}
