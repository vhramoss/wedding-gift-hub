import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Photo = { id: string; url: string; caption?: string | null };

/** Carrossel simples com troca automática das fotos do casal. */
export function PhotoCarousel({ photos, seconds = 6 }: { photos: Photo[]; seconds?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), Math.max(3, seconds) * 1000);
    return () => clearInterval(id);
  }, [photos.length, seconds]);

  const current = photos[Math.min(index, photos.length - 1)];
  if (!current) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 shadow-card">
      <img
        key={current.id}
        src={current.url}
        alt={current.caption ?? "Foto do casal"}
        className="aspect-[3/2] w-full animate-in fade-in object-cover duration-700"
      />
      {current.caption ? (
        <p className="bg-secondary/50 px-4 py-3 text-center text-sm italic text-muted-foreground">
          {current.caption}
        </p>
      ) : null}

      {photos.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-md backdrop-blur"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-md backdrop-blur"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center gap-2">
            {photos.map((p, i) => (
              <span
                key={p.id}
                className={`size-2 rounded-full ${i === index ? "bg-accent" : "bg-background/70"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
