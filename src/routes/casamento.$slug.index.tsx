import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, HeartHandshake, MapPin, Megaphone, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { countdownParts, formatWeddingDate, useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug/")({
  head: ({ params }) => ({
    meta: [
      { title: `Casamento de ${params.slug.replace(/-/g, " ")}` },
      {
        name: "description",
        content:
          "Save the date com contagem regressiva, nossa história, cerimônia e festa, padrinhos, recados, lista de presentes e confirmação de presença.",
      },
      { property: "og:title", content: `Casamento · ${params.slug.replace(/-/g, " ")}` },
      {
        property: "og:description",
        content: "Conheça a história do casal, confirme presença e escolha um presente.",
      },
    ],
  }),
  component: WeddingHome,
});

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-20 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
      <p className="font-display text-4xl text-primary">{String(value).padStart(2, "0")}</p>
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

  const parts = countdownParts(wedding.wedding_date, wedding.party_time);

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
          {wedding.party_time ? (
            <p className="mt-1 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              às {wedding.party_time}
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

      <p className="mx-auto mt-14 max-w-3xl text-center font-display text-2xl leading-relaxed text-muted-foreground">
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
