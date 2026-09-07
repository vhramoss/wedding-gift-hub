import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";
import { formatWeddingDate, isRsvpOpen, useWedding } from "@/hooks/useWedding";

export const Route = createFileRoute("/casamento/$slug/confirmar")({
  head: () => ({
    meta: [
      { title: "Confirmar presença · Casamento" },
      {
        name: "description",
        content:
          "Confirme ou cancele sua presença no casamento, informe acompanhantes e deixe um recado.",
      },
      { property: "og:title", content: "Confirmar presença · Casamento" },
      { property: "og:description", content: "RSVP online para o casamento." },
    ],
  }),
  component: RsvpPage,
});

function RsvpPage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [attending, setAttending] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [companions, setCompanions] = useState(0);
  const [message, setMessage] = useState("");

  const rsvpQuery = useQuery({
    queryKey: ["rsvp", wedding?.id, user?.id],
    enabled: Boolean(wedding?.id && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("wedding_id", wedding!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (rsvpQuery.data) {
      setAttending(rsvpQuery.data.attending);
      setCompanions(rsvpQuery.data.companions);
      setMessage(rsvpQuery.data.message ?? "");
      setGuestName(rsvpQuery.data.guest_name ?? "");
    }
  }, [rsvpQuery.data]);

  const save = useMutation({
    mutationFn: async (override?: { attending: boolean }) => {
      const willAttend = override?.attending ?? attending;
      const { error } = await supabase.from("rsvps").upsert(
        {
          wedding_id: wedding!.id,
          user_id: user!.id,
          guest_name: guestName.trim(),
          attending: willAttend,
          companions: willAttend ? Math.max(0, Math.min(companions, 10)) : 0,
          message: message.trim() || null,
        },
        { onConflict: "wedding_id,user_id" },
      );
      if (error) throw error;
      return willAttend;
    },
    onSuccess: (willAttend) => {
      setAttending(willAttend);
      toast.success(willAttend ? "Presença confirmada. Obrigado!" : "Presença cancelada.");
      queryClient.invalidateQueries({ queryKey: ["rsvp", wedding?.id, user?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  if (!wedding) return null;

  const open = isRsvpOpen(wedding.rsvp_deadline);
  const deadlineText = formatWeddingDate(wedding.rsvp_deadline);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-center font-display text-4xl">Confirmar presença</h1>
      <div className="divider-gold mx-auto my-8 w-32" />

      <Card className="shadow-card border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-2xl">
            <HeartHandshake className="size-5 text-accent" /> Você vem celebrar com a gente?
          </CardTitle>
          {deadlineText ? (
            <p className="text-sm text-muted-foreground">
              {open
                ? `Você pode alterar ou cancelar sua resposta até ${deadlineText}.`
                : `O prazo para alterações terminou em ${deadlineText}.`}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {rsvpQuery.data ? (
            <p className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm">
              Sua resposta atual:{" "}
              <strong>{rsvpQuery.data.attending ? "Presença confirmada" : "Não poderá ir"}</strong>
            </p>
          ) : null}

          {!open ? (
            <div className="flex items-start gap-3 rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 text-accent" />
              <span>
                As confirmações estão encerradas. Fale diretamente com os noivos caso precise
                alterar algo.
              </span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="guestName">Seu nome</Label>
                <Input
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Como os noivos devem te identificar"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant={attending ? "default" : "outline"}
                  onClick={() => setAttending(true)}
                  className="flex-1"
                >
                  Sim, estarei lá
                </Button>
                <Button
                  variant={!attending ? "default" : "outline"}
                  onClick={() => setAttending(false)}
                  className="flex-1"
                >
                  Não poderei ir
                </Button>
              </div>

              {attending ? (
                <div className="space-y-2">
                  <Label htmlFor="companions">Acompanhantes</Label>
                  <Input
                    id="companions"
                    type="number"
                    min={0}
                    max={10}
                    value={companions}
                    onChange={(e) => setCompanions(Number(e.target.value))}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem aos noivos (opcional)</Label>
                <Textarea
                  id="message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => save.mutate(undefined)}
                disabled={save.isPending}
              >
                {rsvpQuery.data ? "Atualizar resposta" : "Confirmar presença"}
              </Button>

              {rsvpQuery.data?.attending ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ attending: false })}
                >
                  Cancelar minha presença
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
