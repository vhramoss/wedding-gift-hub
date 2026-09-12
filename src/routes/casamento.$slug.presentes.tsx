import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Gift, ShoppingBag } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/br";
import { useWedding } from "@/hooks/useWedding";
import { giftQuoteKey, useGiftQuotes } from "@/hooks/useGiftQuotes";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/casamento/$slug/presentes")({
  head: () => ({
    meta: [
      { title: "Lista de presentes · Casamento" },
      {
        name: "description",
        content: "Escolha um presente para o casal e pague com Pix, cartão de débito ou crédito.",
      },
      { property: "og:title", content: "Lista de presentes · Casamento" },
      { property: "og:description", content: "Presenteie os noivos com pagamento online seguro." },
    ],
  }),
  component: GiftsPage,
});

function GiftsPage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);
  const [category, setCategory] = useState<string>("todos");
  const cart = useCart();

  const giftsQuery = useQuery({
    queryKey: ["gifts", wedding?.id],
    enabled: Boolean(wedding?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifts")
        .select("*")
        .eq("wedding_id", wedding!.id)
        .eq("active", true)
        .order("price_cents", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const gifts = giftsQuery.data ?? [];
  const quotesQuery = useGiftQuotes(gifts.map((gift) => ({ giftId: gift.id, shares: 1 })));
  const quotes = quotesQuery.data;
  const cartQuotesQuery = useGiftQuotes(
    cart.items.map((item) => ({ giftId: item.giftId, shares: item.shares })),
  );
  const cartTotal = cart.items.reduce(
    (sum, item) =>
      sum +
      (cartQuotesQuery.data?.get(giftQuoteKey(item.giftId, item.shares))?.total_cents ??
        item.unitCents * item.shares),
    0,
  );
  const categories = ["todos", ...new Set(gifts.map((g) => g.category).filter(Boolean) as string[])];
  const visible = category === "todos" ? gifts : gifts.filter((g) => g.category === category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-center font-display text-3xl sm:text-4xl">Lista de presentes</h1>
      <div className="divider-gold mx-auto my-8 w-32" />
      <p className="mx-auto max-w-2xl text-center text-muted-foreground">
        Sua presença é o melhor presente, mas se quiser nos mimar, escolha uma opção abaixo. O
        pagamento é feito aqui mesmo, por Pix ou cartão.
      </p>

      {cart.count > 0 ? (
        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-accent/40 bg-secondary/40 p-4 sm:flex-row">
          <p className="text-sm">
            <ShoppingBag className="mr-2 inline size-4 text-accent" />
            {cart.count} presente{cart.count > 1 ? "s" : ""} no carrinho ·{" "}
            <strong>{formatBRL(cartTotal)}</strong>
          </p>
          <Button asChild size="sm">
            <Link to="/casamento/$slug/carrinho" params={{ slug }}>
              Finalizar presentes
            </Link>
          </Button>
        </div>
      ) : null}

      {categories.length > 2 ? (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={category === c ? "default" : "outline"}
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      ) : null}

      {giftsQuery.isLoading ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="mt-10 border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">
            <Gift className="mx-auto mb-3 size-6 text-accent" />
            A lista ainda está sendo montada pelos noivos.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((gift) => {
            const sharesTotal = Math.max(1, gift.shares_total ?? 1);
            const sharesLeft = Math.max(0, sharesTotal - gift.purchased_count);
            const sharePrice = Math.ceil(gift.price_cents / sharesTotal);
            const displayedPrice =
              quotes?.get(giftQuoteKey(gift.id, 1))?.total_cents ?? sharePrice;
            const soldOut =
              sharesTotal > 1
                ? sharesLeft === 0
                : gift.quantity > 0 && gift.purchased_count >= gift.quantity;
            return (
              <Card key={gift.id} className="shadow-card overflow-hidden border-border/70 pt-0">
                <div className="h-48 w-full bg-secondary/60">
                  {gift.image_url ? (
                    <img
                      src={gift.image_url}
                      alt={gift.name}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Gift className="size-8 text-accent" />
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-col gap-2">
                  {gift.category ? (
                    <Badge variant="secondary" className="w-fit">
                      {gift.category}
                    </Badge>
                  ) : null}
                  <h2 className="text-xl">{gift.name}</h2>
                  {gift.description ? (
                    <p className="text-sm text-muted-foreground">{gift.description}</p>
                  ) : null}
                  <p className="mt-1 font-display text-3xl text-primary">
                    {formatBRL(displayedPrice)}
                  </p>
                  {sharesTotal > 1 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Por cota · {formatBRL(gift.price_cents)} no total ·{" "}
                        {sharesTotal - sharesLeft} de {sharesTotal} cotas presenteadas
                      </p>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{
                            width: `${Math.round(((sharesTotal - sharesLeft) / sharesTotal) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    disabled={soldOut || cart.has(gift.id)}
                    onClick={() => {
                      cart.add({
                        giftId: gift.id,
                        name: gift.name,
                        imageUrl: gift.image_url,
                        unitCents: displayedPrice,
                        shares: 1,
                        maxShares: sharesTotal > 1 ? sharesLeft : 1,
                        isShared: sharesTotal > 1,
                      });
                      toast.success("Adicionado ao carrinho!");
                    }}
                  >
                    {cart.has(gift.id) ? (
                      <>
                        <Check className="size-4" /> No carrinho
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="size-4" /> Adicionar ao carrinho
                      </>
                    )}
                  </Button>
                  <Button asChild disabled={soldOut}>
                    <Link
                      to="/casamento/$slug/presente/$giftId"
                      params={{ slug, giftId: gift.id }}
                      disabled={soldOut}
                    >
                      {soldOut
                        ? "Já presenteado"
                        : sharesTotal > 1
                          ? "Presentear uma cota"
                          : "Presentear"}
                    </Link>
                  </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
