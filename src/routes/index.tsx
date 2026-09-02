import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Gift, HeartHandshake, ShieldCheck } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMainWedding } from "@/hooks/useMyWedding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nosso Casamento · Site dos noivos e lista de presentes" },
      {
        name: "description",
        content:
          "O site do nosso casamento: nossa história, cerimônia e festa, galeria de fotos, confirmação de presença e lista de presentes com pagamento por Pix, débito ou crédito.",
      },
      { property: "og:title", content: "Nosso Casamento · Site dos noivos" },
      {
        property: "og:description",
        content:
          "Nossa história, informações da festa, galeria de fotos, RSVP e lista de presentes online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: wedding, isLoading } = useMainWedding();

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl space-y-4 p-10">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (wedding) {
    return <Navigate to="/casamento/$slug" params={{ slug: wedding.slug }} replace />;
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="bg-romance">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Site de casamento
          </p>
          <h1 className="text-balance-title mt-5 text-5xl leading-tight font-semibold md:text-6xl">
            O site do casamento de vocês, do jeito que vocês quiserem
          </h1>
          <div className="divider-gold mx-auto my-8 w-40" />
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Contem a história de vocês, publiquem fotos, informem cerimônia e festa, recebam
            confirmações de presença e montem a lista de presentes com pagamento por Pix, débito ou
            crédito parcelado.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/painel">Criar nosso site</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Entrar</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border/70 bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          {[
            {
              icon: HeartHandshake,
              title: "Páginas personalizáveis",
              text: "Nossa história, cerimônia, festa, padrinhos, recados e galeria de fotos.",
            },
            {
              icon: Gift,
              title: "Lista sob medida",
              text: "Os noivos definem cada item e o valor exato que desejam receber.",
            },
            {
              icon: ShieldCheck,
              title: "Convidados identificados",
              text: "Login com e-mail, senha e CPF para acompanhar cada presente e confirmação.",
            },
          ].map((item) => (
            <Card key={item.title} className="border-border/70">
              <CardContent className="space-y-3 py-8 text-center">
                <item.icon className="mx-auto size-8 text-accent" />
                <h3 className="font-display text-2xl">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
