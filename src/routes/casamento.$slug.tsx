import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, Lock, MapPin } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { themeStyle } from "@/lib/theme";
import { formatWeddingDate, useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug")({
  component: WeddingLayout,
});

const PAGES = [
  { to: "/casamento/$slug", label: "Página inicial", exact: true },
  { to: "/casamento/$slug/historia", label: "Nossa história" },
  { to: "/casamento/$slug/avisos", label: "Mensagens aos convidados" },
  { to: "/casamento/$slug/padrinhos", label: "Sobre os padrinhos" },
  { to: "/casamento/$slug/festa", label: "Cerimônia e festa" },
  { to: "/casamento/$slug/galeria", label: "Galeria" },
  { to: "/casamento/$slug/recados", label: "Recados" },
  { to: "/casamento/$slug/fornecedores", label: "Fornecedores" },
] as const;

function WeddingLayout() {
  const { slug } = Route.useParams();
  const { user, loading: loadingSession } = useSession();
  const { data: wedding, isLoading } = useWedding(slug);

  if (loadingSession || (user && isLoading)) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-5xl space-y-4 p-8">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="bg-romance">
          <div className="mx-auto max-w-xl px-4 py-24 text-center">
            <Lock className="mx-auto size-7 text-accent" />
            <h1 className="mt-5 font-display text-4xl">Conteúdo exclusivo dos convidados</h1>
            <div className="divider-gold mx-auto my-7 w-32" />
            <p className="text-muted-foreground">
              Para ver a nossa história, os locais da cerimônia e da festa, as fotos e a lista de
              presentes, entre com o e-mail e a senha criados pelo seu link de convite.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ redirect: `/casamento/${slug}` }}>
                  Entrar
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!wedding) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-xl p-16 text-center">
          <h1 className="font-display text-3xl">Site não encontrado</h1>
          <p className="mt-3 text-muted-foreground">Confira o endereço enviado pelos noivos.</p>
          <Button asChild className="mt-6">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }

  const initials = `${wedding.bride_name.charAt(0)} + ${wedding.groom_name.charAt(0)}`;
  const date = formatWeddingDate(wedding.wedding_date);

  return (
    <div className="min-h-screen bg-background" style={themeStyle(wedding)}>
      <SiteHeader />

      <nav className="sticky top-16 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            to="/casamento/$slug"
            params={{ slug }}
            className="font-display text-2xl tracking-[0.3em] text-accent"
          >
            {initials}
          </Link>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary">
                Páginas <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {PAGES.map((page) => (
                  <DropdownMenuItem key={page.label} asChild>
                    <Link to={page.to} params={{ slug }}>
                      {page.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              to="/casamento/$slug/presentes"
              params={{ slug }}
              activeProps={{ className: "text-primary" }}
              className="px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
            >
              Presentes
            </Link>
            <Link
              to="/casamento/$slug/confirmar"
              params={{ slug }}
              activeProps={{ className: "text-primary" }}
              className="px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
            >
              Confirmar presença
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative border-b border-border/70 bg-romance">
        {wedding.cover_image_url ? (
          <img
            src={wedding.cover_image_url}
            alt={`${wedding.bride_name} e ${wedding.groom_name}`}
            className="absolute inset-0 size-full object-cover opacity-25"
          />
        ) : null}
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="font-display text-5xl font-semibold md:text-6xl">
            {wedding.bride_name} <span className="text-accent">&</span> {wedding.groom_name}
          </h1>
          <div className="divider-gold mx-auto my-6 w-40" />
          <div className="flex flex-wrap justify-center gap-6 text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {date ? (
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4" /> {date}
                {wedding.party_time ? ` · ${wedding.party_time}` : ""}
              </span>
            ) : null}
            {wedding.party_venue || wedding.venue ? (
              <span className="flex items-center gap-2">
                <MapPin className="size-4" /> {wedding.party_venue ?? wedding.venue}
              </span>
            ) : null}
          </div>
          {wedding.party_address ? (
            <p className="mt-3 text-sm text-muted-foreground">{wedding.party_address}</p>
          ) : null}
          {wedding.tagline ? (
            <p className="mx-auto mt-6 max-w-2xl text-lg italic text-muted-foreground">
              {wedding.tagline}
            </p>
          ) : null}
        </div>
      </section>

      <Outlet />

      <footer className="border-t border-border/70 bg-secondary/40 py-10 text-center">
        <p className="font-display text-2xl">
          {wedding.bride_name} & {wedding.groom_name}
        </p>
        {wedding.hashtag ? (
          <p className="mt-2 text-sm uppercase tracking-[0.25em] text-accent">{wedding.hashtag}</p>
        ) : null}
      </footer>
    </div>
  );
}
