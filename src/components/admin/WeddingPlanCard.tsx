import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export type WeddingPlanFields = {
  id: string;
  approval_status?: string | null;
  approval_note?: string | null;
  plan?: string | null;
  plan_fee_cents?: number | null;
  plan_billing?: string | null;
  plan_paid?: boolean | null;
  plan_started_on?: string | null;
  plan_notes?: string | null;
  commission_percent?: number | string | null;
};

const PLAN_LABEL: Record<string, string> = {
  commission: "Só comissão",
  hybrid: "Contrato fixo + comissão",
  fixed: "Só contrato fixo",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando liberação",
  approved: "Liberado",
  rejected: "Recusado",
};

export function WeddingPlanCard({ wedding }: { wedding: WeddingPlanFields }) {
  const queryClient = useQueryClient();
  const status = wedding.approval_status ?? "approved";

  const [plan, setPlan] = useState(wedding.plan ?? "commission");
  const [fee, setFee] = useState(((wedding.plan_fee_cents ?? 0) / 100).toFixed(2));
  const [billing, setBilling] = useState(wedding.plan_billing ?? "once");
  const [paid, setPaid] = useState(Boolean(wedding.plan_paid));
  const [startedOn, setStartedOn] = useState(wedding.plan_started_on ?? "");
  const [notes, setNotes] = useState(wedding.plan_notes ?? "");
  const [commission, setCommission] = useState(String(Number(wedding.commission_percent ?? 0)));
  const [note, setNote] = useState(wedding.approval_note ?? "");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "weddings"] });
  };

  const approval = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase.rpc("set_wedding_approval", {
        _wedding_id: wedding.id,
        _status: next,
        ...(note ? { _note: note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Situação atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      const feeCents = Math.round(Number(fee.replace(",", ".")) * 100);
      const { error } = await supabase.rpc("set_wedding_plan", {
        _wedding_id: wedding.id,
        _plan: plan,
        _fee_cents: Number.isFinite(feeCents) ? feeCents : 0,
        _billing: billing,
        _paid: paid,
        ...(startedOn ? { _started_on: startedOn } : {}),
        ...(notes ? { _notes: notes } : {}),
        _commission_percent: Number(commission.replace(",", ".")) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Plano salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 rounded-lg border border-border/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status === "approved" ? "default" : status === "pending" ? "secondary" : "outline"}>
          {STATUS_LABEL[status] ?? status}
        </Badge>
        <Badge variant="outline">{PLAN_LABEL[plan] ?? plan}</Badge>
        <span className="text-sm text-muted-foreground">
          {plan === "commission"
            ? `${Number(commission) || 0}% por presente`
            : `${fee ? `R$ ${fee}` : "R$ 0,00"} ${billing === "monthly" ? "por mês" : "uma vez"}${
                plan === "hybrid" ? ` + ${Number(commission) || 0}% por presente` : ""
              }`}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`note-${wedding.id}`}>Recado para os noivos (opcional)</Label>
          <Input
            id={`note-${wedding.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: liberado após assinatura do contrato"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" disabled={approval.isPending} onClick={() => approval.mutate("approved")}>
            Liberar site
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={approval.isPending}
            onClick={() => approval.mutate("pending")}
          >
            Deixar aguardando
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={approval.isPending}
            onClick={() => approval.mutate("rejected")}
          >
            Recusar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`plan-${wedding.id}`}>Forma de cobrança</Label>
          <select
            id={`plan-${wedding.id}`}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="commission">Só comissão</option>
            <option value="hybrid">Contrato fixo + comissão</option>
            <option value="fixed">Só contrato fixo</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`fee-${wedding.id}`}>Valor do contrato (R$)</Label>
          <Input
            id={`fee-${wedding.id}`}
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            disabled={plan === "commission"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`billing-${wedding.id}`}>Cobrança</Label>
          <select
            id={`billing-${wedding.id}`}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={billing}
            onChange={(e) => setBilling(e.target.value)}
            disabled={plan === "commission"}
          >
            <option value="once">Uma vez</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`comm-${wedding.id}`}>Comissão por presente (%)</Label>
          <Input
            id={`comm-${wedding.id}`}
            inputMode="decimal"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            disabled={plan === "fixed"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`start-${wedding.id}`}>Início do contrato</Label>
          <Input
            id={`start-${wedding.id}`}
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch id={`paid-${wedding.id}`} checked={paid} onCheckedChange={setPaid} />
          <Label htmlFor={`paid-${wedding.id}`}>Contrato pago</Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`notes-${wedding.id}`}>Observações do contrato</Label>
        <Textarea
          id={`notes-${wedding.id}`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button size="sm" disabled={savePlan.isPending} onClick={() => savePlan.mutate()}>
        {savePlan.isPending ? "Salvando..." : "Salvar plano"}
      </Button>
    </div>
  );
}
