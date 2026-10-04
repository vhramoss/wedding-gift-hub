import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { HeartHandshake, Lock, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatWeddingDate, isRsvpOpen, useWedding } from "@/hooks/useWedding";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/casamento/$slug/confirmar")({
  head: () => ({
    meta: [
      { title: "Confirmar presença · Casamento" },
      {
        name: "description",
        content:
          "Procure seu nome na lista de convidados e confirme sua presença no casamento em poucos segundos.",
      },
      { property: "og:title", content: "Confirmar presença · Casamento" },
      { property: "og:description", content: "Procure seu nome e confirme sua presença." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RsvpPage,
});

type Guest = {
  id: string;
  name: string;
  group_label: string | null;
  max_companions: number;
  attending: boolean | null;
  companions: number;
  attending_ceremony: boolean | null;
  attending_party: boolean | null;
  dietary_notes: string | null;
  companion_names?: string[];
  companions_confirmed?: string[];
};

function RsvpPage() {
  const { slug } = Route.useParams();
  const { data: wedding } = useWedding(slug);
  const { user, loading: loadingSession } = useSession();

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Guest[] | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);

  const [attending, setAttending] = useState(true);
  const [companions, setCompanions] = useState(0);
  const [deps, setDeps] = useState<string[]>([]);
  const [ceremony, setCeremony] = useState(true);
  const [party, setParty] = useState(true);
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [linked, setLinked] = useState<boolean | null>(null);

  // Convidado que entrou pelo convite individual: abre direto a resposta dele.
  useEffect(() => {
    if (!user || !wedding?.id) return;
    supabase.rpc("my_wedding_guest", { _wedding_id: wedding.id }).then(({ data }) => {
      const mine = (data ?? [])[0] as Guest | undefined;
      if (mine) pick(mine);
      setLinked(Boolean(mine));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, wedding?.id]);

  const search = useMutation({
    mutationFn: async () => {
      if (term.trim().length < 3) throw new Error("Digite seu CPF ou pelo menos 3 letras do seu nome.");
      const { data, error } = await supabase.rpc("search_wedding_guests", {
        p_wedding_id: wedding!.id,
        p_query: term.trim(),
      });
      if (error) throw error;
      return (data ?? []) as Guest[];
    },
    onSuccess: (data) => setResults(data),
    onError: (e: Error) => toast.error(e.message),
  });

  const pick = (g: Guest) => {
    setGuest(g);
    setDone(false);
    setAttending(g.attending ?? true);
    setCompanions(g.companions ?? 0);
    setDeps(g.companions_confirmed ?? []);
    setCeremony(g.attending_ceremony ?? true);
    setParty(g.attending_party ?? true);
    setDietary(g.dietary_notes ?? "");
  };

  const save = useMutation({
    mutationFn: async (override?: { attending: boolean }) => {
      const willAttend = override?.attending ?? attending;
      const { error } = await supabase.rpc("respond_wedding_guest", {
        p_guest_id: guest!.id,
        p_attending: willAttend,
        p_companions: willAttend ? (guest!.companion_names?.length ? deps.length : companions) : 0,
        p_ceremony: ceremony,
        p_party: party,
        ...(dietary.trim() ? { p_dietary: dietary.trim() } : {}),
        ...(message.trim() ? { p_message: message.trim() } : {}),
      });
      if (error) throw error;
      if (guest!.companion_names?.length) {
        const { error: depError } = await supabase.rpc("confirm_guest_companions", {
          p_guest_id: guest!.id,
          p_names: willAttend ? deps : [],
        });
        if (depError) throw depError;
      }
      return willAttend;
    },
    onSuccess: (willAttend) => {
      setAttending(willAttend);
      setDone(true);
      toast.success(willAttend ? "Presença confirmada. Obrigado!" : "Resposta registrada.");
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  if (!wedding) return null;

  const open = isRsvpOpen(wedding.rsvp_deadline);
  const deadlineText = formatWeddingDate(wedding.rsvp_deadline);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-center font-display text-3xl sm:text-4xl">Confirmar presença</h1>
      <div className="divider-gold mx-auto my-8 w-32" />

      <Card className="shadow-card border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-2xl">
            <HeartHandshake className="size-5 text-accent" /> Você vem celebrar com a gente?
          </CardTitle>
          {deadlineText ? (
            <p className="text-sm text-muted-foreground">
              {open
                ? `Você pode alterar sua resposta até ${deadlineText}.`
                : `O prazo para respostas terminou em ${deadlineText}.`}
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-6">
          {loadingSession ? null : !user ? (
            <div className="space-y-4 rounded-lg border border-border/60 p-5 text-center">
              <Lock className="mx-auto size-5 text-accent" />
              <p className="text-sm text-muted-foreground">
                Para confirmar presença é preciso entrar com sua conta. Assim os noivos sabem
                exatamente quem respondeu. Ver o site e escolher um presente continua liberado, sem
                login.
              </p>
              <Button asChild>
                <Link to="/auth">Entrar para confirmar</Link>
              </Button>
            </div>
          ) : !open ? (
            <div className="flex items-start gap-3 rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 text-accent" />
              <span>
                As confirmações estão encerradas. Fale diretamente com os noivos caso precise
                alterar algo.
              </span>
            </div>
          ) : linked === null ? null : !guest ? (
            <div className="space-y-2 rounded-lg border border-border/60 p-5 text-center text-sm text-muted-foreground">
              <Lock className="mx-auto size-5 text-accent" />
              <p>
                Não encontramos um convite ligado à sua conta. Abra o link ou QR Code de convite que os
                noivos enviaram para você — a confirmação abre automaticamente.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm">
                <span>
                  Respondendo como <strong>{guest.name}</strong>
                </span>
                {linked ? null : (
                  <Button variant="link" className="px-0" onClick={() => setGuest(null)}>
                    Não sou eu
                  </Button>
                )}
              </div>

              {done ? (
                <p className="rounded-lg border border-border/60 p-4 text-center">
                  {attending
                    ? "Presença confirmada! Até lá 💛"
                    : "Que pena! Sua resposta foi registrada."}
                </p>
              ) : null}

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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Onde você vai estar</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant={ceremony ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setCeremony(!ceremony)}
                      >
                        {ceremony ? "Vou à cerimônia" : "Não vou à cerimônia"}
                      </Button>
                      <Button
                        type="button"
                        variant={party ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setParty(!party)}
                      >
                        {party ? "Vou à festa" : "Não vou à festa"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dietary">Restrição alimentar (opcional)</Label>
                    <Input
                      id="dietary"
                      value={dietary}
                      onChange={(e) => setDietary(e.target.value)}
                      placeholder="Vegetariano, sem glúten, alergia a..."
                    />
                  </div>

                  {guest.companion_names?.length ? (
                    <div className="space-y-2">
                      <Label>Quem vai com você?</Label>
                      {guest.companion_names.map((n) => (
                        <label key={n} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--primary)]"
                            checked={deps.includes(n)}
                            onChange={(e) =>
                              setDeps((d) => (e.target.checked ? [...d, n] : d.filter((x) => x !== n)))
                            }
                          />
                          {n}
                        </label>
                      ))}
                    </div>
                  ) : guest.max_companions > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="companions">
                        Acompanhantes (até {guest.max_companions})
                      </Label>
                      <Input
                        id="companions"
                        type="number"
                        min={0}
                        max={guest.max_companions}
                        value={companions}
                        onChange={(e) => setCompanions(Number(e.target.value))}
                      />
                    </div>
                  ) : null}
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
                Enviar resposta
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
