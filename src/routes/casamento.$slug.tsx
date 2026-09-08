import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, ShoppingBag } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteMusic } from "@/components/SiteMusic";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { themeStyle } from "@/lib/theme";
import { formatWeddingDate, useWedding } from "@/hooks/useWedding";
import { useSession } from "@/hooks/useSession";
import { CartProvider, useCart } from "@/lib/cart";

export const Route = createFileRoute("/casamento/$slug")({
  component: WeddingLayout,
});

const PAGES = [
  { to: "/casamento/$slug/historia", label: "Nossa história" },
  { to: "/casamento/$slug/festa", label: "Cerimônia e festa" },
  { to: "/casamento/$slug/padrinhos", label: "Padrinhos" },
  { to: "/casamento/$slug/galeria", label: "Galeria" },
  { to: "/casamento/$slug/avisos", label: "Avisos" },
  { to: "/casamento/$slug/recados", label: "Recados" },
] as const;

const linkClass =
  "shrink-0 whitespace-nowrap px-2 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary sm:px-3 sm:text-xs sm:tracking-[0.18em]";

const HERO_HEIGHTS: Record<string, string> = {
  normal: "min-h-[45svh]",
  grande: "min-h-[72svh]",
  tela: "min-h-[100svh]",
};


function CartNavLink({ slug }: { slug: string }) {
  const cart = useCart();
  if (cart.count === 0) return null;
  return (
    <Link
      to="/casamento/$slug/carrinho"
      params={{ slug }}
      className="relative shrink-0 whitespace-nowrap rounded-full border border-accent px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent hover:text-accent-foreground sm:text-xs"
    >
      <ShoppingBag className="mr-1 inline size-3.5" />
      Carrinho
      <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
        {cart.count}
      </span>
    </Link>
  );
}

function WeddingLayout() {
  const { slug } = Route.useParams();
  const { data: wedding, isLoading } = useWedding(slug);
  const { user, loading: loadingSession } = useSession();
  const [heroIndex, setHeroIndex] = useState(0);

  const coverPhotosQuery = useQuery({
    queryKey: ["wedding-cover-photos", wedding?.id],
    enabled: Boolean(wedding?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_photos")
        .select("id, url")
        .eq("wedding_id", wedding!.id)
        .eq("show_in_cover", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const covers: string[] = [
    ...(wedding?.cover_image_url ? [wedding.cover_image_url] : []),
    ...(coverPhotosQuery.data ?? []).map((p) => p.url),
  ];
  const rotateSeconds = Math.max(3, wedding?.hero_rotate_seconds ?? 7);

  useEffect(() => {
    if (covers.length < 2) return;
    const id = setInterval(() => setHeroIndex((i) => (i + 1) % covers.length), rotateSeconds * 1000);
    return () => clearInterval(id);
  }, [covers.length, rotateSeconds]);

  if (isLoading) {
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
  const opacity = Math.min(100, Math.max(0, wedding.hero_opacity ?? 30)) / 100;
  const heightClass = HERO_HEIGHTS[wedding.hero_height ?? "grande"] ?? HERO_HEIGHTS["grande"];
  const fitClass = wedding.hero_fit === "inteira" ? "object-contain" : "object-cover";
  const objectPosition = `${Math.min(100, Math.max(0, wedding.hero_pos_x ?? 50))}% ${Math.min(
    100,
    Math.max(0, wedding.hero_pos_y ?? 50),
  )}%`;
  const heroTextStyle = wedding.hero_text_color
    ? ({ color: wedding.hero_text_color } as const)
    : undefined;

  return (
    <CartProvider slug={slug}>
    <div className="min-h-screen bg-background" style={themeStyle(wedding)}>
      <SiteHeader />

      <nav className="sticky top-16 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link
            to="/casamento/$slug"
            params={{ slug }}
            className="shrink-0 font-display text-xl tracking-[0.25em] text-accent sm:text-2xl sm:tracking-[0.3em]"
          >
            {initials}
          </Link>

          <div className="no-scrollbar flex flex-1 items-center justify-end gap-1 overflow-x-auto">
            <Link
              to="/casamento/$slug"
              params={{ slug }}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-primary" }}
              className={linkClass}
            >
              Início
            </Link>
            {PAGES.map((page) => (
              <Link
                key={page.label}
                to={page.to}
                params={{ slug }}
                activeProps={{ className: "text-primary" }}
                className={linkClass}
              >
                {page.label}
              </Link>
            ))}

            <Link
              to="/casamento/$slug/presentes"
              params={{ slug }}
              className="ml-1 shrink-0 whitespace-nowrap rounded-full border border-accent px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent hover:text-accent-foreground sm:text-xs"
            >
              Presentes
            </Link>
            <CartNavLink slug={slug} />
            {!loadingSession && user ? (
              <Link
                to="/casamento/$slug/confirmar"
                params={{ slug }}
                className="shrink-0 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 sm:text-xs"
              >
                Presença
              </Link>
            ) : null}
          </div>
        </div>
      </nav>

      <section
        className={`relative flex items-center justify-center overflow-hidden border-b border-border/70 ${heightClass}`}
        style={{ backgroundImage: "var(--hero-gradient)" }}
      >
        {covers.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${wedding.bride_name} e ${wedding.groom_name}`}
            className={`absolute inset-0 size-full ${fitClass} transition-opacity duration-1000`}
            style={{ opacity: i === heroIndex % covers.length ? opacity : 0, objectPosition }}
          />
        ))}
        <div className="relative mx-auto max-w-5xl px-4 py-12 text-center sm:py-20" style={heroTextStyle}>
          {wedding.monogram ? (
            <div className="mx-auto mb-6 w-fit border px-6 py-4 font-display text-2xl tracking-[0.35em] sm:px-10 sm:py-6 sm:text-3xl"
              style={{ borderColor: wedding.hero_text_color ?? "currentColor" }}
            >
              {wedding.monogram}
            </div>
          ) : null}
          <h1 className="text-balance-title font-display text-4xl font-semibold sm:text-6xl md:text-7xl">
            {wedding.bride_name}{" "}
            <span className={wedding.hero_text_color ? "" : "text-accent"}>&</span>{" "}
            {wedding.groom_name}
          </h1>
          <div className="divider-gold mx-auto my-5 w-28 sm:my-6 sm:w-40" />
          <div
            className={`flex flex-col items-center gap-3 text-xs uppercase tracking-[0.16em] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-6 sm:text-sm sm:tracking-[0.2em] ${
              wedding.hero_text_color ? "opacity-90" : "text-muted-foreground"
            }`}
          >
            {date ? (
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4" /> {date}
                {wedding.ceremony_time ? ` · ${wedding.ceremony_time}` : ""}
              </span>
            ) : null}
            {wedding.party_venue || wedding.venue ? (
              <span className="flex items-center gap-2">
                <MapPin className="size-4" /> {wedding.party_venue ?? wedding.venue}
              </span>
            ) : null}
          </div>
          {wedding.party_address ? (
            <p className={`mt-3 text-sm ${wedding.hero_text_color ? "opacity-90" : "text-muted-foreground"}`}>
              {wedding.party_address}
            </p>
          ) : null}
          {wedding.tagline ? (
            <p
              className={`mx-auto mt-6 max-w-2xl whitespace-pre-line text-lg italic leading-relaxed ${
                wedding.hero_text_color ? "opacity-90" : "text-muted-foreground"
              }`}
            >
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

      {wedding.music_enabled ? (
        <SiteMusic
          url={wedding.music_url}
          title={wedding.music_title}
          autoplay={wedding.music_autoplay}
        />
      ) : null}
    </div>
    </CartProvider>
  );
}
