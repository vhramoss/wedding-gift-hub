import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarHeart, Plus, Send, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const KIND_LABEL: Record<string, string> = {
  save_the_date: "Save the date",
  tarefa: "Tarefa dos convidados",
  aviso: "Recado",
};

const MODELOS: Record<string, { title: string; body: string }> = {
  save_the_date: {
    title: "Guarde a data!",
    body: "Estamos muito felizes em contar que vamos casar! Guarde a data e em breve enviamos todos os detalhes da cerimônia e da festa.",
  },
  tarefa: {
    title: "Não esqueça de confirmar sua presença",
    body: "Falta pouco! Entre no nosso site, procure seu nome na lista e confirme se você vai poder comparecer. Assim conseguimos organizar tudo com carinho.",
  },
  aviso: {
    title: "Um recadinho para você",
    body: "Escreva aqui o recado que quer enviar aos convidados.",
  },
};

export function RemindersTab({ weddingId }: { weddingId: string | null }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState("save_the_date");
  const [title, setTitle] = useState(MODELOS["save_the_date"]!.title);
  const [body, setBody] = useState(MODELOS["save_the_date"]!.body);
  const [sendOn, setSendOn] = useState("");

  const list = useQuery({
    queryKey: ["panel", "reminders", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_reminders")
        .select("id, kind, title, body, send_on, sent_at, recipients_count")
        .eq("wedding_id", weddingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const guests = useQuery({
    queryKey: ["panel", "reminders-guests", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_guests")
        .select("id, email")
        .eq("wedding_id", weddingId!);
      if (error) throw error;
      return (data ?? []).filter((g) => (g.email ?? "").includes("@")).length;
    },
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["panel", "reminders", weddingId] });

  const create = useMutation({
    mutationFn: async () => {
      if (title.trim().length < 3 || body.trim().length < 5) {
        throw new Error("Escreva um título e uma mensagem.");
      }
      const { error } = await supabase.from("wedding_reminders").insert({
        wedding_id: weddingId!,
        kind,
        title: title.trim(),
        body: body.trim(),
        send_on: sendOn || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aviso salvo.");
      setSendOn("");
      invalidate();
    },
    onError: (e: Error) => toast.error("Não deu para salvar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aviso removido.");
      invalidate();
    },
    onError: (e: Error) => toast.error("Não deu para remover", { description: e.message }),
  });

  if (!weddingId) return null;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarHeart className="size-5 text-accent" /> Save the date e lembretes
          </CardTitle>
          <CardDescription>
            Escreva agora as mensagens que os convidados vão receber por e-mail — o “guarde a data”,
            os lembretes de confirmar presença e outros recados. Escolha uma data para sair sozinho
            ou envie na hora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de mensagem</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  setKind(v);
                  const m = MODELOS[v];
                  if (m) {
                    setTitle(m.title);
                    setBody(m.body);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="save_the_date">Save the date</SelectItem>
                  <SelectItem value="tarefa">Tarefa dos convidados</SelectItem>
                  <SelectItem value="aviso">Recado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-date">Enviar no dia (opcional)</Label>
              <Input
                id="reminder-date"
                type="date"
                value={sendOn}
                onChange={(e) => setSendOn(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-title">Título</Label>
            <Input
              id="reminder-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-body">Mensagem</Label>
            <Textarea
              id="reminder-body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Vai para todos os convidados da lista com e-mail cadastrado
            {typeof guests.data === "number" ? ` (${guests.data} hoje)` : ""}.
          </p>

          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="size-4" /> Salvar mensagem
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Mensagens criadas</CardTitle>
          <CardDescription>
            O envio por e-mail é liberado assim que o endereço de e-mail do site estiver ativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(list.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">Nenhuma mensagem criada ainda.</p>
          ) : null}
          {(list.data ?? []).map((r) => (
            <div key={r.id} className="rounded-lg border border-border/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                {r.send_on ? (
                  <Badge variant="secondary">
                    Programado para {new Date(`${r.send_on}T12:00:00`).toLocaleDateString("pt-BR")}
                  </Badge>
                ) : null}
                {r.sent_at ? (
                  <Badge>
                    Enviado ({r.recipients_count}) em{" "}
                    {new Date(r.sent_at).toLocaleDateString("pt-BR")}
                  </Badge>
                ) : null}
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" disabled title="Disponível após ativar o e-mail do site">
                    <Send className="size-4" /> Enviar agora
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate(r.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 font-medium">{r.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
