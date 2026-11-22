import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function MessageModeration({ weddingId }: { weddingId: string }) {
  const qc = useQueryClient();
  const key = ["panel", "message-moderation", weddingId];
  const query = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await supabase.from("wedding_messages").select("id,author_name,body,created_at").eq("wedding_id", weddingId).eq("approved", false).order("created_at", { ascending: true });
    if (error) throw error; return data ?? [];
  }});
  const mutation = useMutation({ mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
    const result = approve ? await supabase.from("wedding_messages").update({ approved: true }).eq("id", id).eq("wedding_id", weddingId) : await supabase.from("wedding_messages").delete().eq("id", id).eq("wedding_id", weddingId);
    if (result.error) throw result.error;
  }, onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ["wedding-messages", weddingId] }); }, onError: () => toast.error("Não foi possível atualizar o recado.") });
  return <section className="border-t pt-6"><h2 className="text-xl font-semibold">Recados aguardando aprovação</h2>{query.isError ? <p className="mt-3 text-destructive">Não foi possível carregar os recados.</p> : <div className="mt-4 space-y-4">{query.data?.map((message) => <article key={message.id} className="border-b pb-4"><h3 className="font-medium">{message.author_name}</h3><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{message.body}</p><div className="mt-3 flex gap-2"><Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: message.id, approve: true })}><Check className="size-4" />Aprovar</Button><Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: message.id, approve: false })}><Trash2 className="size-4" />Excluir</Button></div></article>)}{query.data?.length === 0 ? <p className="text-muted-foreground">Nenhum recado pendente.</p> : null}</div>}</section>;
}