import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug/historia")({
  head: () => ({
    meta: [
      { title: "Nossa história · Casamento" },
      {
        name: "description",
        content: "Como o casal se conheceu, o pedido de casamento e o caminho até o altar.",
      },
      { property: "og:title", content: "Nossa história · Casamento" },
      { property: "og:description", content: "A história do casal, do primeiro encontro ao sim." },
    ],
  }),
  component: StoryPage,
});

function StoryPage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);
  if (!wedding) return null;

  const chapters = [
    { title: "Como nos conhecemos", body: wedding.story_how_we_met },
    { title: "O pedido", body: wedding.story_proposal },
    { title: "E chegamos até aqui", body: wedding.story_text },
  ].filter((c) => Boolean(c.body));

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center font-display text-4xl">Nossa história</h1>
      <div className="divider-gold mx-auto my-8 w-32" />

      {chapters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">
            Os noivos ainda estão escrevendo esta página.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-12">
          {chapters.map((chapter, index) => (
            <article key={chapter.title} className="relative pl-10">
              <span className="absolute left-0 top-1 flex size-7 items-center justify-center rounded-full bg-accent/20">
                <Heart className="size-3.5 text-accent" />
              </span>
              {index < chapters.length - 1 ? (
                <span className="absolute left-3.5 top-9 h-[calc(100%+1.5rem)] w-px bg-border" />
              ) : null}
              <h2 className="font-display text-3xl">{chapter.title}</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
                {chapter.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
