import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MessageCircle, Save, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv } from "@/lib/csv";
import { daysUntil, formatWeddingDate } from "@/hooks/useWedding";
import { GuestDependentsEditor, ExportGuestLinksButton, GuestPasswordCard, GuestQrButton, useGuestInvites } from "@/components/painel/GuestInviteTools";

const DEFAULT_TEMPLATE =
  "Oi {nome}! Nosso casamento é dia {data} e a gente adoraria muito ter você lá. Confirme sua presença aqui: {link}";

type Guest = {
  id: string;
  name: string;
  group_label: string | null;
  phone: string | null;
  cpf: string | null;
  max_companions: number;
  attending: boolean | null;
  companions: number;
  attending_ceremony: boolean | null;
  attending_party: boolean | null;
  dietary_notes: string | null;
  companion_names: string[];
  companions_confirmed: string[];
  message: string | null;
  responded_at: string | null;
  reminder_sent_at: string | null;
};

/** Só dígitos, com DDI do Brasil quando o número vier sem. */
function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/** Lê "Nome; acompanhantes; grupo; telefone; CPF" (ponto e vírgula ou vírgula). */
function parseList(raw: string, weddingId: string) {
  const rows: {
    wedding_id: string;
    name: string;
    max_companions: number;
    group_label: string | null;
    phone: string | null;
    cpf: string | null;
    companion_names: string[];
  }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) continue;
    const parts = clean.split(/[;\t]|,(?![^|]*\|)/).map((p) => p.trim());
    const name = parts[0];
    if (!name || /^(nome|convidado)$/i.test(name)) continue;
    const deps = (parts[5] ?? "").split("|").map((d) => d.trim()).filter(Boolean).slice(0, 20);
    rows.push({
      wedding_id: weddingId,
      name,
      max_companions: deps.length || Math.max(0, Math.min(Number(parts[1] ?? 0) || 0, 20)),
      companion_names: deps,
      group_label: parts[2] || null,
      phone: parts[3] || null,
      cpf: parts[4] ? parts[4].replace(/\D/g, "") || null : null,
    });
  }
  return rows;
}

/** Passo a passo didático da confirmação de presença, para os noivos não se perderem. */
function RsvpHowItWorks() {
  const steps = [
    {
      title: "1. Monte a lista",
      text: "Adicione cada convidado com nome, grupo, telefone e CPF. Quem não estiver na lista não consegue confirmar presença. Se alguém levar dependentes (filhos, acompanhantes), cadastre os nomes deles — só esse convidado verá os nomes para marcar na confirmação.",
    },
    {
      title: "2. Defina a senha do casamento",
      text: "É uma senha única que todos os convidados usam ao criar o perfil pelo convite. Eles não precisam inventar senha — informe a senha junto com o convite.",
    },
    {
      title: "3. Envie o convite de cada pessoa",
      text: "No cartão de cada convidado, toque em “Convite” para mostrar o QR Code (a pessoa escaneia com a câmera do celular) ou copie o link. Se preferir, use “Exportar convites individuais” para baixar um link pronto para cada convidado e enviar por WhatsApp.",
    },
    {
      title: "4. Acompanhe as respostas",
      text: "Os números no topo mostram quem confirmou e quem ainda não respondeu. Use os lembretes de WhatsApp para lembrar quem falta, e exporte a planilha quando quiser levar a contagem ao cerimonial.",
    },
  ];
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Como funciona a confirmação de presença</CardTitle>
        <CardDescription>
          Siga os 4 passos abaixo, na ordem — depois é só aguardar as respostas chegarem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((s) => (
          <div key={s.title} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {s.title.slice(0, 1)}
            </span>
            <div>
              <p className="font-medium">{s.title.slice(3)}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          </div>
        ))}
        <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          O convidado escaneia o código, cria o perfil uma única vez com nome e CPF e já confirma a
          presença na mesma tela — depois, tudo dele fica na área do seu casamento.
        </p>
      </CardContent>
    </Card>
  );
}

export function GuestListTab({ weddingId }: { weddingId: string | null }) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState("");
  const [filter, setFilter] = useState("");

  const guestsQuery = useQuery({
    queryKey: ["panel", "guests", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_guests")
        .select(
          "id, name, group_label, phone, cpf, max_companions, attending, companions, attending_ceremony, attending_party, dietary_notes, companion_names, companions_confirmed, message, responded_at, reminder_sent_at",
        )
        .eq("wedding_id", weddingId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Guest[];
    },
  });

  const guests = guestsQuery.data ?? [];
  const guestInvites = useGuestInvites(weddingId ?? "").data ?? [];

  const stats = useMemo(() => {
    const yes = guests.filter((g) => g.attending === true);
    return {
      total: guests.length,
      confirmed: yes.length,
      people: yes.reduce((sum, g) => sum + 1 + (g.companions ?? 0), 0),
      declined: guests.filter((g) => g.attending === false).length,
      pending: guests.filter((g) => g.attending === null).length,
    };
  }, [guests]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) => g.name.toLowerCase().includes(q));
  }, [guests, filter]);

  const importList = useMutation({
    mutationFn: async () => {
      const rows = parseList(raw, weddingId!);
      if (rows.length === 0) throw new Error("Escreva pelo menos um nome.");
      const { error } = await supabase.from("wedding_guests").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      setRaw("");
      toast.success(`${n} convidado(s) adicionados à lista.`);
      queryClient.invalidateQueries({ queryKey: ["panel", "guests", weddingId] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível importar", {
        description: e.message.includes("duplicate")
          ? "Há nomes repetidos com quem já está na lista."
          : e.message,
      }),
  });

  const removeGuest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_guests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panel", "guests", weddingId] }),
  });

  const weddingQuery = useQuery({
    queryKey: ["panel", "reminder-config", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("id, slug, wedding_date, rsvp_reminder_enabled, rsvp_reminder_days, rsvp_reminder_template")
        .eq("id", weddingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [reminder, setReminder] = useState({ enabled: false, days: 15, template: DEFAULT_TEMPLATE });

  useEffect(() => {
    const w = weddingQuery.data;
    if (!w) return;
    setReminder({
      enabled: w.rsvp_reminder_enabled ?? false,
      days: w.rsvp_reminder_days ?? 15,
      template: w.rsvp_reminder_template || DEFAULT_TEMPLATE,
    });
  }, [weddingQuery.data]);

  const saveReminder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("weddings")
        .update({
          rsvp_reminder_enabled: reminder.enabled,
          rsvp_reminder_days: Math.min(180, Math.max(1, Number(reminder.days) || 15)),
          rsvp_reminder_template: reminder.template.trim() || DEFAULT_TEMPLATE,
        })
        .eq("id", weddingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lembrete configurado!");
      queryClient.invalidateQueries({ queryKey: ["panel", "reminder-config", weddingId] });
    },
    onError: (e: Error) => toast.error("Não deu para salvar", { description: e.message }),
  });

  const wedding = weddingQuery.data;
  const remaining = daysUntil(wedding?.wedding_date);
  const windowOpen =
    reminder.enabled && remaining !== null && remaining >= 0 && remaining <= reminder.days;

  const rsvpLink =
    typeof window !== "undefined" && wedding?.slug
      ? `${window.location.origin}/casamento/${wedding.slug}/confirmar`
      : "";

  function buildMessage(guestName: string) {
    return reminder.template
      .replaceAll("{nome}", guestName)
      .replaceAll("{data}", formatWeddingDate(wedding?.wedding_date) ?? "em breve")
      .replaceAll("{link}", rsvpLink);
  }

  const pendingReminders = useMemo(
    () => guests.filter((g) => g.attending === null && g.phone && waNumber(g.phone)),
    [guests],
  );

  const markSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wedding_guests")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panel", "guests", weddingId] }),
  });

  function sendReminder(guest: Guest) {
    const link = `https://wa.me/${waNumber(guest.phone ?? "")}?text=${encodeURIComponent(buildMessage(guest.name))}`;
    window.open(link, "_blank", "noopener");
    markSent.mutate(guest.id);
  }

  if (!weddingId) return null;

  return (
    <div className="space-y-6">
      <RsvpHowItWorks />
      <GuestPasswordCard weddingId={weddingId} />
      <div className="flex justify-end">
        <ExportGuestLinksButton weddingId={weddingId} guests={guests} />
      </div>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-2xl">
            <Users className="size-5 text-accent" /> Lista de convidados
          </CardTitle>
          <CardDescription>
            Só quem estiver nesta lista consegue confirmar presença no site. O convidado procura o
            próprio nome e responde — não precisa de conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Na lista", stats.total],
              ["Confirmados", stats.confirmed],
              ["Pessoas esperadas", stats.people],
              ["Sem resposta", stats.pending],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border/60 p-3 text-center">
                <p className="font-display text-2xl text-primary">{value}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-import">Adicionar convidados (um por linha)</Label>
            <Textarea
              id="guest-import"
              rows={6}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"Maria Silva; 2; Família da noiva; 19999999999; 123.456.789-00; Pedro Silva | Lia Silva\nJoão Souza; 0; Amigos\nAna Lima"}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Um convidado por linha: <strong>nome; acompanhantes; grupo; telefone; CPF; dependentes</strong> (nomes
              separados por |). Dá para colar direto da planilha. Só o convidado que tem dependentes
              com nome cadastrados vê os nomes para confirmar — os outros não podem incluir ninguém.
              Se quiser usar o convite por CPF, o CPF precisa estar aqui.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => importList.mutate()} disabled={importList.isPending}>
              <Upload className="size-4" /> Adicionar à lista
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "lista-de-convidados.csv",
                  ["Convidado", "CPF", "Grupo", "Resposta", "Dependentes", "Dependentes confirmados", "Acompanhantes", "Cerimônia", "Festa", "Restrição", "Recado"],
                  guests.map((g) => [
                    g.name,
                    g.cpf ?? "",
                    g.group_label ?? "",
                    g.attending === null ? "Sem resposta" : g.attending ? "Vai" : "Não vai",
                    (g.companion_names ?? []).join(" | "),
                    (g.companions_confirmed ?? []).join(" | "),
                    g.companions,
                    g.attending_ceremony ? "Sim" : "Não",
                    g.attending_party ? "Sim" : "Não",
                    g.dietary_notes ?? "",
                    g.message ?? "",
                  ]),
                )
              }
            >
              <Download className="size-4" /> Exportar planilha
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-2xl">
            <MessageCircle className="size-5 text-accent" /> Lembrete de confirmação no WhatsApp
          </CardTitle>
          <CardDescription>
            Quando faltar o número de dias escolhido, quem ainda não respondeu aparece aqui com a
            mensagem pronta — é só tocar em “Enviar”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <p className="font-medium">Ligar os lembretes</p>
              <p className="text-sm text-muted-foreground">
                {remaining === null
                  ? "Escolha a data do casamento em “Nosso site”."
                  : windowOpen
                    ? `Faltam ${remaining} dia(s): já é hora de lembrar quem não respondeu.`
                    : `Faltam ${remaining} dia(s) para o casamento.`}
              </p>
            </div>
            <Switch
              checked={reminder.enabled}
              onCheckedChange={(v) => setReminder({ ...reminder, enabled: v })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-days">Começar a lembrar quantos dias antes</Label>
            <Input
              id="reminder-days"
              type="number"
              min={1}
              max={180}
              value={reminder.days}
              onChange={(e) => setReminder({ ...reminder, days: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-template">Mensagem</Label>
            <Textarea
              id="reminder-template"
              rows={4}
              className="min-h-28 resize-y leading-relaxed"
              value={reminder.template}
              onChange={(e) => setReminder({ ...reminder, template: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{nome}"}, {"{data}"} e {"{link}"} — trocamos automaticamente pelos dados de cada
              convidado.
            </p>
          </div>

          <Button onClick={() => saveReminder.mutate()} disabled={saveReminder.isPending}>
            <Save className="size-4" /> Salvar lembrete
          </Button>

          <div className="space-y-3 border-t border-border/60 pt-5">
            <p className="text-sm font-medium">
              Sem resposta e com telefone: {pendingReminders.length}
            </p>
            {!reminder.enabled ? (
              <p className="text-sm text-muted-foreground">Ligue os lembretes para usar esta lista.</p>
            ) : pendingReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguém pendente com telefone cadastrado.
              </p>
            ) : (
              pendingReminders.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.phone}
                      {g.reminder_sent_at
                        ? ` · lembrete enviado em ${new Date(g.reminder_sent_at).toLocaleDateString("pt-BR")}`
                        : " · ainda não lembrado"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => sendReminder(g)}>
                    <MessageCircle className="size-4" />{" "}
                    {g.reminder_sent_at ? "Enviar de novo" : "Enviar"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>


      <div className="space-y-2">
        <Label htmlFor="guest-filter">Procurar na lista</Label>
        <Input
          id="guest-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Digite um nome"
        />
      </div>

      <div className="space-y-3">
        {shown.map((g) => (
          <Card key={g.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 font-medium">{g.name}</p>
                <Badge
                  variant={g.attending === true ? "default" : g.attending === false ? "destructive" : "secondary"}
                >
                  {g.attending === null ? "Sem resposta" : g.attending ? "Confirmado" : "Não vai"}
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">
                  {g.group_label ? `${g.group_label} · ` : ""}
                  Pode levar {g.max_companions} acompanhante(s)
                  {g.attending ? ` · confirmou ${g.companions}` : ""}
                </p>
                <GuestDependentsEditor guestId={g.id} names={g.companion_names ?? []} confirmed={g.companions_confirmed ?? []} />
                {g.dietary_notes ? (
                  <p className="text-sm text-muted-foreground">Restrição: {g.dietary_notes}</p>
                ) : null}
                {g.message ? (
                  <p className="mt-1 text-sm italic text-muted-foreground">“{g.message}”</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
              <GuestQrButton weddingId={weddingId} guestId={g.id} guestName={g.name} invites={guestInvites} />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover ${g.name}`}
                onClick={() => removeGuest.mutate(g.id)}
              >
                <Trash2 className="size-4" />
              </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {guests.length === 0 ? (
          <p className="text-muted-foreground">A lista ainda está vazia.</p>
        ) : null}
      </div>
    </div>
  );
}
