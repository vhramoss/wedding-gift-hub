import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug/padrinhos")({
  head: () => ({
    meta: [
      { title: "Padrinhos e fornecedores · Casamento" },
      {
        name: "description",
        content: "Conheça os padrinhos, madrinhas e os fornecedores que fazem parte do grande dia.",
      },
      { property: "og:title", content: "Padrinhos e fornecedores · Casamento" },
      { property: "og:description", content: "As pessoas queridas que estão ao lado do casal." },
    ],
  }),
  component: PeoplePage,
});

const GROUPS = [
  { kind: "madrinha", title: "Madrinhas" },
  { kind: "padrinho", title: "Padrinhos" },
  { kind: "fornecedor", title: "Fornecedores" },
] as const;

function PeoplePage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);

  const peopleQuery = useQuery({
    queryKey: ["wedding-people", wedding?.id],
    enabled: Boolean(wedding?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_people")
        .select("*")
        .eq("wedding_id", wedding!.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const people = peopleQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center font-display text-4xl">Quem está com a gente</h1>
      <div className="divider-gold mx-auto my-8 w-32" />

      {peopleQuery.isLoading ? (
        <div className="grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 size-6 text-accent" />
            Os noivos ainda não cadastraram os padrinhos.
          </CardContent>
        </Card>
      ) : (
        GROUPS.map((group) => {
          const list = people.filter((p) => p.kind === group.kind);
          if (list.length === 0) return null;
          return (
            <section key={group.kind} className="mb-14">
              <h2 className="font-display text-3xl">{group.title}</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((person) => (
                  <Card key={person.id} className="shadow-card overflow-hidden border-border/70 pt-0">
                    <div className="h-44 w-full bg-secondary/60">
                      {person.photo_url ? (
                        <img
                          src={person.photo_url}
                          alt={person.name}
                          className="h-44 w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Users className="size-8 text-accent" />
                        </div>
                      )}
                    </div>
                    <CardContent>
                      {person.role ? (
                        <Badge variant="secondary" className="mb-2">
                          {person.role}
                        </Badge>
                      ) : null}
                      <h3 className="text-xl">{person.name}</h3>
                      {person.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{person.description}</p>
                      ) : null}
                      {person.website_url ? (
                        <a
                          href={person.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                        >
                          <ExternalLink className="size-3.5" /> Site
                        </a>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
