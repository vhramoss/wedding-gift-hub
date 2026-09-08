import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CoOwner = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  is_primary: boolean;
  added_at: string;
};

function linkFor(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/convite/${token}`;
}

export function CoOwnersCard({ weddingId }: { weddingId: string | null | undefined }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const people = useQuery({
    queryKey: ["panel", "coowners", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wedding_coowners", { _wedding_id: weddingId! });
      if (error) throw error;
      return (data ?? []) as CoOwner[];
    },
  });

  const createLink = useMutation({
    mutationFn: async () => {
      const args: { _wedding_id: string; _email?: string; _note?: string } = {
        _wedding_id: weddingId!,
        _note: "Acesso de noivos",
      };
      const typed = email.trim();
      if (typed) args._email = typed;
      const { data, error } = await supabase.rpc("create_coowner_invite", args);
      if (error) throw error;
      return data as string;
    },
    onSuccess: (token) => {
      const url = linkFor(token);
      setLink(url);
      setEmail("");
      void navigator.clipboard?.writeText(url);
      toast.success("Link criado e copiado!");
    },
    onError: (e: Error) => toast.error("Não deu para criar o link", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_wedding_coowner", {
        _wedding_id: weddingId!,
        _user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso removido.");
      queryClient.invalidateQueries({ queryKey: ["panel", "coowners", weddingId] });
    },
    onError: (e: Error) => toast.error("Não deu para remover", { description: e.message }),
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Quem acessa o painel dos noivos</CardTitle>
        <CardDescription>
          Crie um segundo acesso para a noiva (ou o noivo) entrar com a conta dela e cuidar do mesmo
          casamento. Ela cria a conta pelo link e já entra no painel de vocês.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="coowner-email">E-mail da pessoa (opcional)</Label>
            <Input
              id="coowner-email"
              type="email"
              placeholder="noiva@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button onClick={() => createLink.mutate()} disabled={!weddingId || createLink.isPending}>
            <UserPlus className="mr-2 size-4" />
            Gerar link de acesso
          </Button>
        </div>

        {link ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-secondary/30 p-4 sm:flex-row sm:items-center">
            <code className="flex-1 break-all text-xs">{link}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(link);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="mr-2 size-4" />
              Copiar
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {(people.data ?? []).map((person) => (
            <div
              key={person.user_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-4 py-3"
            >
              <div>
                <p className="font-medium">{person.full_name || person.email || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{person.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={person.is_primary ? "default" : "secondary"}>
                  {person.is_primary ? "Titular" : "Acesso extra"}
                </Badge>
                {person.is_primary ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate(person.user_id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {people.data && people.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém com acesso ainda.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
