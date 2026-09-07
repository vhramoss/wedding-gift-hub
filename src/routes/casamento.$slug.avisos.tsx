import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug/avisos")({
  head: () => ({
    meta: [
      { title: "Mensagens aos convidados · Casamento" },
      {
        name: "description",
        content: "Avisos e mensagens enviados pelos noivos a todos os convidados do casamento.",
      },
      { property: "og:title", content: "Mensagens aos convidados" },
      { property: "og:description", content: "Avisos importantes enviados pelos noivos." },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);

  const query = useQuery({
    queryKey: ["announcements", wedding?.id],
    enabled: Boolean(wedding?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_announcements")
        .select("*")
        .eq("wedding_id", wedding!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const items = query.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center font-display text-4xl">Mensagens aos convidados</h1>
      <div className="divider-gold mx-auto my-8 w-32" />

      {items.length === 0 ? (
        <p className="text-center text-muted-foreground">
          Ainda não há avisos publicados pelos noivos.
        </p>
      ) : (
        <div className="space-y-5">
          {items.map((item) => (
            <Card key={item.id} className="shadow-card border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-2xl">
                  <Megaphone className="size-5 text-accent" />
                  {item.title || "Aviso dos noivos"}
                </CardTitle>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString("pt-BR", { dateStyle: "long" })}
                </p>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
