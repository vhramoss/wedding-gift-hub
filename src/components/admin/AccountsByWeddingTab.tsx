import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { maskCPF } from "@/lib/br";

type Person = {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  source: string;
};

export function AccountsByWeddingTab() {
  const query = useQuery({
    queryKey: ["admin", "accounts-by-wedding"],
    queryFn: async () => {
      const [weddings, profiles, roles, invites, rsvps, orders] = await Promise.all([
        supabase.from("weddings").select("id, slug, bride_name, groom_name, owner_id"),
        supabase.from("profiles").select("id, full_name, cpf, phone"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("wedding_invites").select("wedding_id, role, used_by"),
        supabase.from("rsvps").select("wedding_id, user_id, guest_name, attending"),
        supabase.from("orders").select("wedding_id, user_id, guest_name"),
      ]);
      for (const r of [weddings, profiles, roles, invites, rsvps, orders]) {
        if (r.error) throw r.error;
      }
      return {
        weddings: weddings.data ?? [],
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        invites: invites.data ?? [],
        rsvps: rsvps.data ?? [],
        orders: orders.data ?? [],
      };
    },
  });

  const groups = useMemo(() => {
    const d = query.data;
    if (!d) return [];
    const profileById = new Map(d.profiles.map((p) => [p.id, p]));
    const isOwnerRole = new Set(d.roles.filter((r) => r.role === "owner").map((r) => r.user_id));

    return d.weddings.map((w) => {
      const owners: Person[] = [];
      const seenOwner = new Set<string>();
      const addOwner = (userId: string | null, source: string) => {
        if (!userId || seenOwner.has(userId)) return;
        seenOwner.add(userId);
        const p = profileById.get(userId);
        owners.push({
          id: userId,
          name: p?.full_name || "Conta sem nome",
          cpf: p?.cpf ?? null,
          phone: p?.phone ?? null,
          source,
        });
      };
      addOwner(w.owner_id, "Responsável pelo site");
      for (const inv of d.invites) {
        if (inv.wedding_id === w.id && inv.role === "owner" && inv.used_by) {
          addOwner(inv.used_by, isOwnerRole.has(inv.used_by) ? "Convite aceito" : "Convite sem acesso");
        }
      }

      const guests: Person[] = [];
      const seenGuest = new Set<string>();
      const addGuest = (userId: string | null, fallback: string, source: string) => {
        if (!userId || seenGuest.has(userId) || seenOwner.has(userId)) return;
        seenGuest.add(userId);
        const p = profileById.get(userId);
        guests.push({
          id: userId,
          name: p?.full_name || fallback || "Convidado",
          cpf: p?.cpf ?? null,
          phone: p?.phone ?? null,
          source,
        });
      };
      for (const inv of d.invites) {
        if (inv.wedding_id === w.id && inv.role === "guest" && inv.used_by) {
          addGuest(inv.used_by, "", "Entrou pelo convite");
        }
      }
      for (const r of d.rsvps) {
        if (r.wedding_id === w.id) {
          addGuest(r.user_id, r.guest_name, r.attending ? "Confirmou presença" : "Respondeu que não vai");
        }
      }
      for (const o of d.orders) {
        if (o.wedding_id === w.id) addGuest(o.user_id, o.guest_name, "Escolheu presente");
      }

      return {
        id: w.id,
        title: `${w.bride_name} & ${w.groom_name}`,
        slug: w.slug,
        owners,
        guests,
      };
    });
  }, [query.data]);

  if (query.isLoading) return <Skeleton className="h-64 w-full" />;
  if (query.error) {
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar as contas: {(query.error as Error).message}
      </p>
    );
  }
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum casamento cadastrado ainda.</p>;
  }

  const totalOwners = new Set(groups.flatMap((g) => g.owners.map((o) => o.id))).size;
  const totalGuests = new Set(groups.flatMap((g) => g.guests.map((o) => o.id))).size;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/70">
          <CardContent className="flex items-center gap-3 py-5">
            <Heart className="size-5 text-accent" />
            <div>
              <p className="text-2xl font-semibold">{totalOwners}</p>
              <p className="text-sm text-muted-foreground">contas de noivos ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="flex items-center gap-3 py-5">
            <Users className="size-5 text-accent" />
            <div>
              <p className="text-2xl font-semibold">{totalGuests}</p>
              <p className="text-sm text-muted-foreground">contas de convidados ativas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {groups.map((g) => (
        <Card key={g.id} className="border-border/70">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{g.title}</CardTitle>
            <CardDescription>
              /{g.slug} · {g.owners.length} noivo(s) · {g.guests.length} convidado(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <PeopleList title="Noivos" people={g.owners} empty="Nenhuma conta de noivos vinculada." />
            <PeopleList title="Convidados" people={g.guests} empty="Nenhum convidado cadastrado ainda." />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PeopleList({ title, people, empty }: { title: string; people: Person[]; empty: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {people.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.cpf ? maskCPF(p.cpf) : null, p.phone].filter(Boolean).join(" · ") ||
                    "sem dados de contato"}
                </p>
              </div>
              <Badge variant="secondary">{p.source}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
