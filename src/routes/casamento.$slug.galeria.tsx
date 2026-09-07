import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug/galeria")({
  head: ({ params }) => ({
    meta: [
      { title: `Galeria de fotos · Casamento ${params.slug}` },
      {
        name: "description",
        content: "Fotos do casal, do pedido e dos momentos que levaram até o grande dia.",
      },
      { property: "og:title", content: "Galeria de fotos do casal" },
      {
        property: "og:description",
        content: "Veja as fotos favoritas dos noivos antes do grande dia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);

  const photosQuery = useQuery({
    queryKey: ["wedding-photos", wedding?.id],
    enabled: Boolean(wedding?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_photos")
        .select("id, url, caption")
        .eq("wedding_id", wedding!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const photos = photosQuery.data ?? [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <header className="text-center">
        <h2 className="font-display text-4xl">Nossa galeria</h2>
        <div className="divider-gold mx-auto my-6 w-32" />
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Alguns dos nossos momentos preferidos até aqui.
        </p>
      </header>

      {photos.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">
          As fotos serão publicadas em breve.
        </p>
      ) : (
        <div className="mt-12 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>figure]:mb-4">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="break-inside-avoid overflow-hidden rounded-xl border border-border/70 shadow-card"
            >
              <img
                src={photo.url}
                alt={photo.caption ?? "Foto do casal"}
                loading="lazy"
                className="w-full object-cover"
              />
              {photo.caption ? (
                <figcaption className="bg-secondary/40 px-4 py-3 text-sm italic text-muted-foreground">
                  {photo.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
