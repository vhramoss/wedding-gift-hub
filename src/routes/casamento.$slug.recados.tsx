import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleHeart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [agreed, setAgreed] = useState(false);

  const messagesQuery = useQuery({
    queryKey: ["wedding-messages", wedding?.id],
    enabled: Boolean(wedding?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_messages")
        .select("id, author_name, body, created_at")
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

  useEffect(() => {
    if (profileQuery.data?.full_name) setName(profileQuery.data.full_name);
  }, [profileQuery.data]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (name.trim().length < 2) throw new Error("Escreva seu nome.");
      if (body.trim().length < 3) throw new Error("Escreva uma mensagem um pouco maior.");
      if (!agreed) throw new Error("Confirme que você concorda com os termos.");
      const { error } = await supabase.rpc("post_public_message", {
        p_wedding_id: wedding!.id,
        p_name: name.trim(),
        p_body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      setAgreed(false);
      toast.success("Recado enviado!");
      queryClient.invalidateQueries({ queryKey: ["wedding-messages", wedding?.id] });
    },
    onError: (e: Error) => toast.error("Não deu para enviar", { description: e.message }),
  });

  const messages = messagesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center font-display text-3xl sm:text-4xl">Deixe seu recado</h1>
      <div className="divider-gold mx-auto my-8 w-32" />
      <p className="mx-auto max-w-xl text-center text-muted-foreground">
        Escreva uma mensagem para o casal. Ela aparece aqui no mural para todos os convidados.
      </p>

      <Card className="shadow-card mt-10">
        <CardHeader>
          <CardTitle className="text-xl">Sua mensagem</CardTitle>
          <CardDescription>Não é preciso ter conta para deixar um recado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recado-nome">Seu nome</Label>
            <Input
              id="recado-nome"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como você quer aparecer no mural"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recado-texto">Recado</Label>
            <Textarea
              id="recado-texto"
              value={body}
              maxLength={1000}
              rows={5}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva com carinho…"
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            <span>
              Ao deixar um recado, declaro que li e concordo com os{" "}
              <Link to="/termos" className="text-accent underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" className="text-accent underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
          <div className="text-center">
            <Button onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending}>
              Enviar recado
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-12 space-y-6">
        {messagesQuery.isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground">
            <MessageCircleHeart className="mx-auto mb-2 size-6 text-accent" />
            Seja a primeira pessoa a deixar um recado.
          </p>
        ) : (
          messages.map((m) => (
            <article key={m.id} className="border-l-2 border-accent/60 pl-4">
              <h2 className="font-display text-xl text-primary">{m.author_name}</h2>
              <p className="mt-1 whitespace-pre-line leading-relaxed text-muted-foreground">
                {m.body}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
