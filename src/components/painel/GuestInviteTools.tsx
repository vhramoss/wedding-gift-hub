import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy, KeyRound, Link2, QrCode } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseDependentNames } from "@/lib/guest-display";
import { downloadCsv } from "@/lib/csv";

export function guestInviteUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/entrar/${token}`;
}

function newToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
}

type Invite = { id: string; token: string; guest_id: string | null; used_at: string | null };

/** Convites individuais (um por convidado da lista). */
export function useGuestInvites(weddingId: string) {
  return useQuery({
    queryKey: ["guest-invites", weddingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_invites")
        .select("id, token, guest_id, used_at")
        .eq("wedding_id", weddingId)
        .not("guest_id", "is", null);
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });
}

async function createGuestInvite(weddingId: string, guestId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const token = newToken();
  const { error } = await supabase.from("wedding_invites").insert({
    token,
    role: "guest",
    wedding_id: weddingId,
    guest_id: guestId,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
  return token;
}

export function GuestPasswordCard({ weddingId }: { weddingId: string }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const q = useQuery({
    queryKey: ["guest-password", weddingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("wedding_guest_passwords")
        .select("password")
        .eq("wedding_id", weddingId)
        .maybeSingle();
      return data?.password ?? "";
    },
  });
  useEffect(() => setValue(q.data ?? ""), [q.data]);

  async function save() {
    if (value.trim().length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("wedding_guest_passwords")
      .upsert({ wedding_id: weddingId, password: value.trim(), updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Senha do casamento salva!");
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-2xl">
          <KeyRound className="size-5 text-accent" /> Senha do casamento
        </CardTitle>
        <CardDescription>
          Todos os convidados que criarem perfil pelo QR Code usam esta mesma senha — eles não precisam
          inventar uma. Para entrar de novo, informe a eles esta senha. Trocar a senha vale só para os
          próximos cadastros.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: bia&pedro2026" />
        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar senha"}</Button>
      </CardContent>
    </Card>
  );
}

/** Exporta um link de convite único por convidado (cria os que faltam). */
export function ExportGuestLinksButton({ weddingId, guests }: { weddingId: string; guests: { id: string; name: string; phone: string | null }[] }) {
  const { data: invites = [] } = useGuestInvites(weddingId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const map = new Map(invites.filter((i) => !i.used_at).map((i) => [i.guest_id, i.token]));
      const used = new Set(invites.filter((i) => i.used_at).map((i) => i.guest_id));
      const rows: string[][] = [];
      for (const g of guests) {
        if (used.has(g.id)) { rows.push([g.name, g.phone ?? "", "", "Perfil já criado"]); continue; }
        const token = map.get(g.id) ?? (await createGuestInvite(weddingId, g.id));
        rows.push([g.name, g.phone ?? "", guestInviteUrl(token), "Aguardando cadastro"]);
      }
      downloadCsv("convites-individuais.csv", ["Nome", "Telefone", "Link do convite", "Situação"], rows);
      qc.invalidateQueries({ queryKey: ["guest-invites", weddingId] });
    } catch (e) {
      toast.error("Erro ao gerar convites", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" onClick={run} disabled={busy || guests.length === 0}>
      <Link2 className="size-4" /> {busy ? "Gerando..." : "Exportar convites individuais"}
    </Button>
  );
}

export function GuestQrButton({ weddingId, guestId, guestName, invites }: { weddingId: string; guestId: string; guestName: string; invites: Invite[] }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const used = invites.some((i) => i.guest_id === guestId && i.used_at);

  async function openQr() {
    const existing = invites.find((i) => i.guest_id === guestId && !i.used_at);
    try {
      const t = existing?.token ?? (await createGuestInvite(weddingId, guestId));
      setToken(t);
      qc.invalidateQueries({ queryKey: ["guest-invites", weddingId] });
    } catch (e) {
      toast.error("Erro ao gerar convite", { description: (e as Error).message });
    }
  }

  if (used) return <span className="text-xs text-muted-foreground">Perfil criado</span>;
  return (
    <>
      <Button variant="outline" size="sm" onClick={openQr}>
        <QrCode className="size-4" /> Convite
      </Button>
      <Dialog open={Boolean(token)} onOpenChange={(o) => !o && setToken(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convite de {guestName}</DialogTitle>
          <DialogDescription>
            Mostre ou envie este código para {guestName} (por WhatsApp, por exemplo). No primeiro
            acesso, ele cria o perfil com o nome e o CPF — e usa a senha do casamento definida acima.
          </DialogDescription>
          </DialogHeader>
          {token ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={guestInviteUrl(token)} size={200} />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(guestInviteUrl(token));
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="size-4" /> Copiar link
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Noivos definem os dependentes (com nome) que só este convidado pode confirmar. */
export function GuestDependentsEditor({ guestId, names, confirmed }: { guestId: string; names: string[]; confirmed: string[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(names.join(", "));
  async function save() {
    const list = parseDependentNames(text);
    const { error } = await supabase
      .from("wedding_guests")
      .update({ companion_names: list, max_companions: list.length, companions_confirmed: confirmed.filter((c) => list.includes(c)) })
      .eq("id", guestId);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Dependentes salvos!");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["panel", "guests"] });
  }
  if (!editing)
    return (
      <div className="mt-1 text-sm text-muted-foreground">
        {names.length ? (
          <>Dependentes: {names.map((n) => (confirmed.includes(n) ? `${n} ✓` : n)).join(", ")} </>
        ) : null}
        <button type="button" className="text-primary underline" onClick={() => setEditing(true)}>
          {names.length ? "editar" : "Adicionar dependentes"}
        </button>
      </div>
    );
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <Textarea aria-label="Nomes dos dependentes" value={text} onChange={(e) => setText(e.target.value)} placeholder="Um nome por linha ou separados por vírgula" rows={3} />
      <Button size="sm" onClick={save}>Salvar</Button>
    </div>
  );
}
