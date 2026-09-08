import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, HeartHandshake, MapPin, Megaphone, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { countdownParts, formatWeddingDate, useWedding } from "@/hooks/useWedding";
import { getWeddingPreview } from "@/lib/wedding-public.functions";

export const Route = createFileRoute("/casamento/$slug/")({
  loader: ({ params }) => getWeddingPreview({ data: { slug: params.slug } }),
  head: ({ params, loaderData }) => {
    const couple = loaderData
      ? `${loaderData.bride_name} & ${loaderData.groom_name}`
      : params.slug.replace(/-/g, " ");
    const description =
      loaderData?.tagline ||
      loaderData?.welcome_message ||
      "Save the date com contagem regressiva, nossa história, cerimônia e festa, padrinhos, recados, lista de presentes e confirmação de presença.";
    const cover = loaderData?.cover_image_url;
    const isAbsolute = typeof cover === "string" && cover.startsWith("https://");
    return {
      meta: [
        { title: `Casamento de ${couple}` },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: `Casamento de ${couple}` },
        { property: "og:description", content: description.slice(0, 155) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(isAbsolute
          ? [
              { property: "og:image", content: cover },
              { name: "twitter:image", content: cover },
            ]
          : []),
      ],
    };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-xl p-16 text-center text-muted-foreground">
      Não foi possível carregar esta página agora. Atualize para tentar de novo.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl p-16 text-center text-muted-foreground">
      Casamento não encontrado.
    </div>
  ),
  component: WeddingHome,
});

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-16 rounded-lg border border-border/60 bg-background/70 px-3 py-3 sm:min-w-20 sm:px-4">
      <p className="font-display text-2xl text-primary sm:text-4xl">{String(value).padStart(2, "0")}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
    </div>
  );
}

function WeddingHome() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!wedding) return null;

  const startTime = wedding.ceremony_time || wedding.party_time;
  const parts = countdownParts(wedding.wedding_date, startTime);

  const shortcuts = [
    {
      to: "/casamento/$slug/historia" as const,
      icon: Sparkles,
      title: "Nossa história",
      text: "Como tudo começou até o grande dia.",
    },
    {
      to: "/casamento/$slug/festa" as const,
      icon: MapPin,
      title: "Cerimônia e festa",
      text: "Local, horários, traje e dicas.",
    },
    {
      to: "/casamento/$slug/avisos" as const,
      icon: Megaphone,
      title: "Mensagens dos noivos",
      text: "Recados e avisos importantes.",
    },
    {
      to: "/casamento/$slug/presentes" as const,
      icon: Gift,
      title: "Lista de presentes",
      text: "Presenteie por Pix ou cartão.",
    },
    {
      to: "/casamento/$slug/confirmar" as const,
      icon: HeartHandshake,
      title: "Confirmar presença",
      text: "Avise se poderá celebrar com a gente.",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {parts ? (
        <section className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-10 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Save the date</p>
          <p className="mt-3 font-display text-3xl">{formatWeddingDate(wedding.wedding_date)}</p>
          {startTime ? (
            <p className="mt-1 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              cerimônia às {startTime}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {parts.past ? (
              <p className="font-display text-3xl text-primary">Hoje é o grande dia!</p>
            ) : (
              <>
                <Unit value={parts.days} label="dias" />
                <Unit value={parts.hours} label="horas" />
                <Unit value={parts.minutes} label="min" />
                <Unit value={parts.seconds} label="seg" />
              </>
            )}
          </div>
        </section>
      ) : null}

      <p className="mx-auto mt-14 max-w-3xl whitespace-pre-line text-center font-display text-xl leading-loose tracking-wide text-muted-foreground sm:text-2xl">
        {wedding.welcome_message ??
          "Nossa felicidade é ainda maior quando compartilhada. Esperamos você para celebrar com a gente!"}
      </p>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Card key={item.title} className="shadow-card border-border/70">
            <CardContent className="flex items-start gap-4">
              <item.icon className="mt-1 size-5 text-accent" />
              <div className="flex-1">
                <h2 className="font-display text-2xl">{item.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                <Button asChild variant="link" className="mt-2 px-0">
                  <Link to={item.to} params={{ slug }}>
                    Ver mais
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
