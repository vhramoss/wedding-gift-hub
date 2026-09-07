import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  CalendarHeart,
  Gift,
  HeartHandshake,
  Images,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMainWedding } from "@/hooks/useMyWedding";
import { useSession } from "@/hooks/useSession";
import { useMyRoles } from "@/hooks/useRoles";
import { BRAND, whatsappLink } from "@/lib/brand";
import portfolioCeremony from "@/assets/portfolio-ceremony.jpg";
import portfolioGifts from "@/assets/portfolio-gifts.jpg";
import portfolioParty from "@/assets/portfolio-party.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} · Sites de casamento com lista de presentes` },
      {
        name: "description",
        content:
          "Criamos o site do seu casamento: nossa história, cerimônia e festa, galeria, confirmação de presença por QR Code e lista de presentes com Pix, débito e crédito.",
      },
      { property: "og:title", content: `${BRAND.name} · Sites de casamento sob medida` },
      {
        property: "og:description",
        content:
          "Site exclusivo para o casal, convites com QR Code, RSVP e lista de presentes online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const PORTFOLIO = [
  {
    image: portfolioCeremony,
    title: "Página inicial com save the date",
    text: "Contagem regressiva, capa do casal e todas as informações da cerimônia em um só lugar.",
  },
  {
    image: portfolioGifts,
    title: "Lista de presentes personalizada",
    text: "Cada item com o valor exato que o casal deseja receber, pago por Pix, débito ou crédito.",
  },
  {
    image: portfolioParty,
    title: "Convidados identificados",
    text: "Convites com link e QR Code, confirmação de presença e recados para os noivos.",
  },
];

function Home() {
  const { user, loading: loadingSession } = useSession();
  const { isSuperAdmin, isLoading: rolesLoading } = useMyRoles(user?.id);
  const { data: wedding, isLoading } = useMainWedding();

  if (loadingSession || (user && (isLoading || rolesLoading))) {
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

  // Convidados e noivos vão direto ao site do casamento; o super admin escolhe qual administrar.
  if (user && !isSuperAdmin && wedding) {
    return <Navigate to="/casamento/$slug" params={{ slug: wedding.slug }} replace />;
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="bg-romance">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{BRAND.tagline}</p>
          <h1 className="text-balance-title mt-5 text-5xl leading-tight font-semibold md:text-6xl">
            O site do casamento de vocês, feito com carinho e sob medida
          </h1>
          <div className="divider-gold mx-auto my-8 w-40" />
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            A gente senta com os noivos, monta cada página do site, cadastra a lista de presentes com
            os valores que vocês quiserem e entrega os convites prontos, com link e QR Code para os
            convidados.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-5" />
                Entrar em contato
              </a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            WhatsApp {BRAND.phoneDisplay} — respondemos com um orçamento sem compromisso.
          </p>
          {isSuperAdmin ? (
            <div className="mt-6">
              <Button asChild variant="ghost" size="sm">
                <Link to="/super-admin">
                  <ShieldCheck className="size-4" /> Ir para o painel de administração
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-t border-border/70">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center">
            <h2 className="font-display text-4xl">Portfólio</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Alguns dos ambientes que criamos para os nossos casais.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {PORTFOLIO.map((item) => (
              <Card key={item.title} className="overflow-hidden border-border/70">
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className="h-56 w-full object-cover"
                />
                <CardContent className="space-y-2 py-6">
                  <h3 className="font-display text-2xl">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/70 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center">
            <h2 className="font-display text-4xl">Tudo o que o site inclui</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
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
                icon: CalendarHeart,
                title: "Save the date",
                text: "Contagem regressiva na página inicial e prazo de confirmação configurável.",
              },
              {
                icon: QrCode,
                title: "Convites com QR Code",
                text: "Cada convidado entra por um link exclusivo ou escaneando o QR Code.",
              },
              {
                icon: Images,
                title: "Galeria do casal",
                text: "Fotos publicadas pelos próprios noivos, quando e como quiserem.",
              },
              {
                icon: Smartphone,
                title: "Pagamento na hora",
                text: "Pix, débito e crédito parcelado direto na página do presente.",
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
        </div>
      </section>

      <section className="border-t border-border/70">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="font-display text-4xl">Vamos criar o site de vocês?</h2>
          <p className="mt-3 text-muted-foreground">
            Fale com a gente pelo WhatsApp {BRAND.phoneDisplay} e receba um orçamento.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-5" /> Entrar em contato
              </a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/70 py-8 text-center text-sm text-muted-foreground">
        {BRAND.full} · WhatsApp {BRAND.phoneDisplay}
      </footer>
    </div>
  );
}
