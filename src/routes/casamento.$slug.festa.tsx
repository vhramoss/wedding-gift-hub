import { createFileRoute } from "@tanstack/react-router";
import { Church, Clock, ExternalLink, MapPin, PartyPopper, Shirt, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWeddingDate, useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug/festa")({
  head: () => ({
    meta: [
      { title: "Cerimônia e festa · Casamento" },
      {
        name: "description",
        content: "Local, endereço, horários, traje sugerido e dicas para os convidados.",
      },
      { property: "og:title", content: "Cerimônia e festa · Casamento" },
      { property: "og:description", content: "Onde e a que horas acontece a celebração." },
    ],
  }),
  component: PartyPage,
});

function PartyPage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);
  if (!wedding) return null;

  const date = formatWeddingDate(wedding.wedding_date);
  const partyVenue = wedding.party_venue ?? wedding.venue;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center font-display text-4xl">Cerimônia e festa</h1>
      <div className="divider-gold mx-auto my-8 w-32" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <Church className="size-5 text-accent" /> Cerimônia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            {wedding.ceremony_venue ? (
              <p className="text-lg text-foreground">{wedding.ceremony_venue}</p>
            ) : (
              <p>Local a confirmar pelos noivos.</p>
            )}
            {wedding.ceremony_address ? (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" /> {wedding.ceremony_address}
              </p>
            ) : null}
            <p className="flex items-center gap-2">
              <Clock className="size-4" /> {date ?? "Data a confirmar"}
              {wedding.ceremony_time ? ` · ${wedding.ceremony_time}` : ""}
            </p>
            {wedding.ceremony_map_url ? (
              <Button asChild variant="outline" size="sm">
                <a href={wedding.ceremony_map_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Ver no mapa
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-card overflow-hidden border-border/70 pt-0">
          {wedding.party_image_url ? (
            <img
              src={wedding.party_image_url}
              alt={partyVenue ?? "Local da festa"}
              className="h-44 w-full object-cover"
              loading="lazy"
            />
          ) : null}
          <CardHeader className={wedding.party_image_url ? "pt-6" : ""}>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <PartyPopper className="size-5 text-accent" /> Festa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            {partyVenue ? (
              <p className="text-lg text-foreground">{partyVenue}</p>
            ) : (
              <p>Local a confirmar pelos noivos.</p>
            )}
            {wedding.party_address ? (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" /> {wedding.party_address}
              </p>
            ) : null}
            <p className="flex items-center gap-2">
              <Clock className="size-4" /> {date ?? "Data a confirmar"}
              {wedding.party_time ? ` · ${wedding.party_time}` : ""}
            </p>
            {wedding.party_map_url ? (
              <Button asChild variant="outline" size="sm">
                <a href={wedding.party_map_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Ver no mapa
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <Shirt className="size-5 text-accent" /> Traje
            </CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-muted-foreground">
            {wedding.dress_code ?? "Traje social. Detalhes em breve."}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <Sparkles className="size-5 text-accent" /> Dicas
            </CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-muted-foreground">
            {wedding.tips ?? "Chegue com antecedência e prepare-se para dançar até o fim."}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
