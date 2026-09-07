import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, MapPin, MessageCircle, Phone, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function waLink(number: string, message: string) {
  return `https://wa.me/55${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function VendorDirectory({ message }: { message?: string }) {
  const [term, setTerm] = useState("");

  const vendorsQuery = useQuery({
    queryKey: ["vendors", "directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("active", true)
        .order("featured", { ascending: false })
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const vendors = useMemo(() => {
    const list = vendorsQuery.data ?? [];
    const q = term.trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) =>
      [v.name, v.category, v.city, v.description].some((f) => (f ?? "").toLowerCase().includes(q)),
    );
  }, [vendorsQuery.data, term]);

  return (
    <div className="space-y-6">
      <Input
        placeholder="Buscar por nome, categoria ou cidade"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        className="max-w-sm"
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {vendors.map((vendor) => (
          <Card key={vendor.id} className="overflow-hidden border-border/70 shadow-card">
            {vendor.logo_url ? (
              <img
                src={vendor.logo_url}
                alt={vendor.name}
                loading="lazy"
                className="h-40 w-full object-cover"
              />
            ) : (
              <div className="flex h-40 items-center justify-center bg-secondary/50">
                <Store className="size-8 text-accent" />
              </div>
            )}
            <CardContent className="space-y-3 py-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-2xl">{vendor.name}</h3>
                {vendor.featured ? <Badge>Destaque</Badge> : null}
              </div>
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                {vendor.category}
                {vendor.city ? ` · ${vendor.city}` : ""}
              </p>
              {vendor.description ? (
                <p className="text-sm text-muted-foreground">{vendor.description}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                {vendor.whatsapp ? (
                  <Button asChild size="sm">
                    <a
                      href={waLink(
                        vendor.whatsapp,
                        message ?? "Olá! Vi o anúncio de vocês no site do nosso casamento.",
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                  </Button>
                ) : null}
                {vendor.website_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={vendor.website_url} target="_blank" rel="noopener noreferrer">
                      <Globe className="size-4" /> Site
                    </a>
                  </Button>
                ) : null}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {vendor.phone ? (
                  <p className="flex items-center gap-2">
                    <Phone className="size-3" /> {vendor.phone}
                  </p>
                ) : null}
                {vendor.city ? (
                  <p className="flex items-center gap-2">
                    <MapPin className="size-3" /> {vendor.city}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vendors.length === 0 ? (
        <p className="text-muted-foreground">Nenhum fornecedor cadastrado por enquanto.</p>
      ) : null}
    </div>
  );
}
