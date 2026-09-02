import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = { weddingId: string | null };

export function AnnouncementsTab({ weddingId }: Props) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["panel", "announcements", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_announcements")
        .select("*")
        .eq("wedding_id", weddingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const body = String(form.get("body") ?? "").trim();
      if (!body) throw new Error("Escreva a mensagem.");
      const { error } = await supabase.from("wedding_announcements").insert({
        wedding_id: weddingId!,
        title: String(form.get("title") ?? "").trim(),
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem enviada aos convidados!");
      queryClient.invalidateQueries({ queryKey: ["panel", "announcements", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e: Error) => toast.error("Erro ao enviar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel", "announcements", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  if (!weddingId) return <p className="text-muted-foreground">Cadastre o casamento primeiro.</p>;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Nova mensagem geral</CardTitle>
          <CardDescription>
            Publicada na aba “Mensagens aos convidados” para todos os convidados cadastrados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const el = e.currentTarget;
              create.mutate(new FormData(el), { onSuccess: () => el.reset() });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="ann-title">Título</Label>
              <Input id="ann-title" name="title" maxLength={120} placeholder="Aviso importante" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-body">Mensagem</Label>
              <Textarea id="ann-body" name="body" rows={5} required />
            </div>
            <Button type="submit" disabled={create.isPending}>
              <Megaphone className="size-4" /> Publicar mensagem
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(listQuery.data ?? []).map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{item.title || "Aviso dos noivos"}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {item.body}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove.mutate(item.id)}
                aria-label="Remover mensagem"
              >
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {(listQuery.data ?? []).length === 0 ? (
          <p className="text-muted-foreground">Nenhuma mensagem publicada ainda.</p>
        ) : null}
      </div>
    </div>
  );
}
