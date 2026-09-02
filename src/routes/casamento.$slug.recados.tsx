import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleHeart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug/recados")({
  head: () => ({
    meta: [
      { title: "Recados aos noivos · Casamento" },
      {
        name: "description",
        content: "Deixe uma mensagem carinhosa para o casal e leia os recados dos convidados.",
      },
      { property: "og:title", content: "Recados aos noivos · Casamento" },
      { property: "og:description", content: "Mural de mensagens dos convidados para o casal." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const messagesQuery = useQuery({
    queryKey: ["wedding-messages", wedding?.id],
    enabled: Boolean(wedding?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_messages")
        .select("*")
        .eq("wedding_id", wedding!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (text.length < 3) throw new Error("Escreva uma mensagem um pouco maior.");
      const { error } = await supabase.from("wedding_messages").insert({
        wedding_id: wedding!.id,
        user_id: user!.id,
        author_name: profileQuery.data?.full_name || "Convidado",
        body: text.slice(0, 1000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      toast.success("Recado enviado!");
      queryClient.invalidateQueries({ queryKey: ["wedding-messages", wedding?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível enviar", { description: e.message }),
  });

  if (!wedding) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center font-display text-4xl">Recados aos noivos</h1>
      <div className="divider-gold mx-auto my-8 w-32" />

      <Card className="shadow-card border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-2xl">
            <MessageCircleHeart className="size-5 text-accent" /> Deixe sua mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <>
              <Textarea
                value={body}
                maxLength={1000}
                rows={4}
                placeholder="Escreva um carinho para o casal..."
                onChange={(e) => setBody(e.target.value)}
              />
              <Button onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending}>
                Enviar recado
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-muted-foreground">Entre na sua conta para deixar um recado.</p>
              <Button
                onClick={() =>
                  navigate({ to: "/auth", search: { redirect: `/casamento/${slug}/recados` } })
                }
              >
                Entrar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-10 space-y-4">
        {messagesQuery.isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (messagesQuery.data ?? []).length === 0 ? (
          <p className="text-center text-muted-foreground">
            Seja o primeiro a deixar um recado para os noivos.
          </p>
        ) : (
          (messagesQuery.data ?? []).map((message) => (
            <Card key={message.id} className="border-border/70">
              <CardContent>
                <p className="whitespace-pre-line text-muted-foreground">{message.body}</p>
                <p className="mt-3 font-display text-lg">
                  {message.author_name || "Convidado"}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
