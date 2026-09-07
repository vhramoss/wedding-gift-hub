import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Plus, Trash2, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/br";

type Props = { weddingId: string | null };

function toCents(value: string) {
  const n = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function FinanceTab({ weddingId }: Props) {
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["panel", "orders", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("amount_cents, status")
        .eq("wedding_id", weddingId!);
      if (error) throw error;
      return data;
    },
  });

  const vendorsQuery = useQuery({
    queryKey: ["vendors", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, category")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const expensesQuery = useQuery({
    queryKey: ["panel", "expenses", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_expenses")
        .select("*, vendors(name)")
        .eq("wedding_id", weddingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const title = String(form.get("title") ?? "").trim();
      if (!title) throw new Error("Dê um nome para a conta.");
      const amount = toCents(String(form.get("amount") ?? ""));
      if (amount <= 0) throw new Error("Informe um valor válido (ex.: 1.500,00).");
      const vendorId = String(form.get("vendor") ?? "");
      const { error } = await supabase.from("wedding_expenses").insert({
        wedding_id: weddingId!,
        title,
        category: String(form.get("category") ?? "").trim() || null,
        vendor_id: vendorId || null,
        amount_cents: amount,
        paid_cents: toCents(String(form.get("paid") ?? "")),
        due_date: String(form.get("due") ?? "") || null,
        installments: Math.max(1, Number(form.get("installments") ?? 1) || 1),
        installments_paid: Math.max(0, Number(form.get("installmentsPaid") ?? 0) || 0),
        pay_from_gifts: form.get("fromGifts") === "on",
        notes: String(form.get("notes") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta adicionada ao controle financeiro.");
      queryClient.invalidateQueries({ queryKey: ["panel", "expenses", weddingId] });
    },
    onError: (e: Error) => toast.error("Erro ao adicionar", { description: e.message }),
  });

  const settle = useMutation({
    mutationFn: async ({
      id,
      amountCents,
      installments,
    }: {
      id: string;
      amountCents: number;
      installments: number;
    }) => {
      const { error } = await supabase
        .from("wedding_expenses")
        .update({ paid_cents: amountCents, status: "paid", installments_paid: installments })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel", "expenses", weddingId] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta removida.");
      queryClient.invalidateQueries({ queryKey: ["panel", "expenses", weddingId] });
    },
  });

  const expenses = expensesQuery.data ?? [];
  const received = (ordersQuery.data ?? [])
    .filter((o) => o.status === "paid")
    .reduce((acc, o) => acc + o.amount_cents, 0);
  const paidFromGifts = expenses
    .filter((e) => e.pay_from_gifts)
    .reduce((acc, e) => acc + e.paid_cents, 0);
  const balance = received - paidFromGifts;
  const totalPlanned = expenses.reduce((acc, e) => acc + e.amount_cents, 0);
  const totalPaid = expenses.reduce((acc, e) => acc + e.paid_cents, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Recebido em presentes", value: received },
          { label: "Usado dos presentes", value: paidFromGifts },
          { label: "Saldo disponível", value: balance, highlight: true },
          { label: "Total das contas", value: totalPlanned },
        ].map((item) => (
          <Card key={item.label} className="shadow-card">
            <CardContent className="py-6 text-center">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                {item.label}
              </p>
              <p
                className={`mt-2 text-2xl font-medium ${item.highlight ? "text-primary" : ""}`}
              >
                {formatBRL(item.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Adicionar conta do casamento</CardTitle>
          <CardDescription>
            Registre buffet, fotógrafo, decoração ou qualquer despesa. Marque “pagar com o saldo dos
            presentes” para descontar do que já foi recebido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              const el = e.currentTarget;
              e.preventDefault();
              create.mutate(new FormData(el), { onSuccess: () => el.reset() });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="expense-title">Conta</Label>
              <Input id="expense-title" name="title" required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-category">Categoria</Label>
              <Input id="expense-category" name="category" placeholder="Buffet, decoração..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-vendor">Fornecedor (opcional)</Label>
              <select
                id="expense-vendor"
                name="vendor"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Conta própria / outro</option>
                {(vendorsQuery.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-due">Vencimento</Label>
              <Input id="expense-due" name="due" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Valor total (R$)</Label>
              <Input id="expense-amount" name="amount" required placeholder="1.500,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-paid">Já pago (R$)</Label>
              <Input id="expense-paid" name="paid" placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-installments">Número de parcelas</Label>
              <Input
                id="expense-installments"
                name="installments"
                type="number"
                min={1}
                max={99}
                defaultValue={1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-installments-paid">Parcelas já pagas</Label>
              <Input
                id="expense-installments-paid"
                name="installmentsPaid"
                type="number"
                min={0}
                max={99}
                defaultValue={0}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="expense-notes">Observações</Label>
              <Textarea id="expense-notes" name="notes" maxLength={500} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox id="fromGifts" name="fromGifts" />
              <Label htmlFor="fromGifts" className="font-normal">
                Pagar com o saldo dos presentes
              </Label>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={!weddingId || create.isPending}>
                <Plus className="size-4" /> Adicionar conta
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {expenses.map((expense) => {
          const pending = expense.amount_cents - expense.paid_cents;
          return (
            <Card key={expense.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg">{expense.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {expense.vendors?.name ?? "Conta própria"}
                    {expense.category ? ` · ${expense.category}` : ""}
                    {expense.due_date
                      ? ` · vence em ${new Date(`${expense.due_date}T12:00:00`).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {expense.pay_from_gifts ? (
                      <Badge variant="secondary">
                        <Wallet className="mr-1 size-3" /> Saldo dos presentes
                      </Badge>
                    ) : null}
                    <Badge variant={pending <= 0 ? "default" : "secondary"}>
                      {pending <= 0 ? "Quitada" : `Falta ${formatBRL(pending)}`}
                    </Badge>
                    {expense.installments > 1 ? (
                      <Badge variant="outline">
                        {expense.installments_paid}/{expense.installments} parcelas de{" "}
                        {formatBRL(Math.round(expense.amount_cents / expense.installments))}
                      </Badge>
                    ) : null}
                  </div>
                  {expense.notes ? (
                    <p className="mt-2 text-sm italic text-muted-foreground">{expense.notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xl font-medium text-primary">
                      {formatBRL(expense.amount_cents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      pago {formatBRL(expense.paid_cents)}
                    </p>
                  </div>
                  {pending > 0 ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        settle.mutate({
                          id: expense.id,
                          amountCents: expense.amount_cents,
                          installments: expense.installments,
                        })
                      }
                    >
                      <CheckCircle2 className="size-4" /> Quitar
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${expense.title}`}
                    onClick={() => remove.mutate(expense.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {expenses.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhuma conta cadastrada. Total já pago: {formatBRL(totalPaid)}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
