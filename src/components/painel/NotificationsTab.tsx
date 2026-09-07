import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** Monta o link do WhatsApp com o aviso já escrito. */
function waLink(phone: string, text: string) {
  const digits = onlyDigits(phone);
  const e164 = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}

export function NotificationsTab({ weddingId }: { weddingId: string | null }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState<string | null>(null);

  const weddingQuery = useQuery({
    queryKey: ["panel", "notify-phone", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("notify_whatsapp")
        .eq("id", weddingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["panel", "notifications", weddingId],
    enabled: Boolean(weddingId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_notifications")
        .select("*")
        .eq("wedding_id", weddingId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const savePhone = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("weddings")
        .update({ notify_whatsapp: value.trim() || null })
        .eq("id", weddingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("WhatsApp salvo.");
      queryClient.invalidateQueries({ queryKey: ["panel", "notify-phone", weddingId] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("wedding_notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["panel", "notifications", weddingId] }),
  });

  const removeOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["panel", "notifications", weddingId] }),
  });

  const items = notificationsQuery.data ?? [];
  const unread = items.filter((n) => !n.read_at);
  const savedPhone = weddingQuery.data?.notify_whatsapp ?? "";
  const phoneValue = phone ?? savedPhone;

  const summaryText = unread.length
    ? `Novidades do nosso casamento:\n\n${unread
        .slice(0, 10)
        .map((n) => `• ${n.title}: ${n.body}`)
        .join("\n")}`
    : "Nenhuma novidade por enquanto.";

  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="font-display text-xl">Avisos no WhatsApp</CardTitle>
          <CardDescription>
            Toda vez que um convidado paga um presente ou confirma presença, o aviso aparece aqui.
            Com o número salvo, você envia o resumo para o WhatsApp de vocês com um toque.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="notify-phone">Número com DDD</Label>
              <Input
                id="notify-phone"
                inputMode="tel"
                placeholder="(19) 99999-9999"
                value={phoneValue}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button
              onClick={() => savePhone.mutate(phoneValue)}
              disabled={savePhone.isPending || !weddingId}
            >
              Salvar número
            </Button>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!savedPhone || !unread.length}
          >
            <a
              href={savedPhone ? waLink(savedPhone, summaryText) : "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" />
              Enviar resumo no WhatsApp
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="font-display text-xl">
              <Bell className="mr-2 inline size-5 text-accent" />
              Novidades
            </CardTitle>
            <CardDescription>
              {unread.length ? `${unread.length} aviso(s) não lido(s)` : "Tudo em dia"}
            </CardDescription>
          </div>
          {unread.length ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markRead.mutate(unread.map((n) => n.id))}
            >
              <Check className="size-4" /> Marcar tudo como lido
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum aviso ainda. Assim que chegar um presente ou uma confirmação, aparece aqui.
            </p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/70 p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    {!n.read_at ? <Badge variant="secondary">novo</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!n.read_at ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Marcar como lido"
                      onClick={() => markRead.mutate([n.id])}
                    >
                      <Check className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remover aviso"
                    onClick={() => removeOne.mutate(n.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
