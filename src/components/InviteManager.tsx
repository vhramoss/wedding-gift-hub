import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Download, Link2, QrCode, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppRole } from "@/hooks/useRoles";

function newToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
}

function inviteUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/convite/${token}`;
}

type Props = {
  /** Quando informado, os convites ficam vinculados a esse casamento. */
  weddingId?: string | null;
  /** Perfis que este usuário pode convidar. */
  roles?: AppRole[];
  title?: string;
  description?: string;
};

export function InviteManager({
  weddingId = null,
  roles = ["owner", "guest"],
  title = "Novo convite",
  description = "O link só funciona depois que a pessoa criar a conta ou entrar.",
}: Props) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<AppRole>(roles[0] ?? "guest");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("30");
  const [qrToken, setQrToken] = useState<string | null>(null);

  const invitesQuery = useQuery({
    queryKey: ["invites", weddingId],
    queryFn: async () => {
      let query = supabase.from("wedding_invites").select("*").order("created_at", { ascending: false });
      if (weddingId) query = query.eq("wedding_id", weddingId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Faça login novamente para gerar o convite.");
      const expires =
        Number(days) > 0 ? new Date(Date.now() + Number(days) * 86_400_000).toISOString() : null;
      const token = newToken();
      const { error } = await supabase.from("wedding_invites").insert({
        token,
        role,
        wedding_id: weddingId,
        email: email.trim() || null,
        note: note.trim() || null,
        expires_at: expires,
        created_by: auth.user.id,
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      toast.success("Convite gerado!");
      setEmail("");
      setNote("");
      setQrToken(token);
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (e: Error) => toast.error("Erro ao gerar convite", { description: e.message }),
  });

  const removeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invites"] }),
  });

  async function copyLink(token: string) {
    const url = inviteUrl(token);
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!", { description: url });
  }

  function downloadQr(token: string) {
    const svg = document.getElementById(`qr-${token}`);
    if (!(svg instanceof SVGSVGElement)) return;
    const source = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 640;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 640, 640);
      ctx.drawImage(image, 40, 40, 560, 560);
      const link = document.createElement("a");
      link.download = `convite-${token.slice(0, 8)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`;
  }

  const roleLabel = (r: string) => (r === "owner" ? "Noivos" : r === "admin" ? "Admin" : "Convidado");

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createInvite.mutate();
            }}
          >
            {roles.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="invite-role">Tipo de acesso</Label>
                <select
                  id="invite-role"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AppRole)}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r === "owner" ? "Noivos (área de edição)" : "Convidado"}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="invite-days">Validade (dias)</Label>
              <Input
                id="invite-days"
                type="number"
                min={0}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail (opcional)</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-note">Nome / observação (opcional)</Label>
              <Input id="invite-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={createInvite.isPending}>
                <Link2 className="size-4" /> Gerar link + QR Code
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Convites gerados</CardTitle>
          <CardDescription>
            Compartilhe o link ou mostre/baixe o QR Code para o convidado escanear.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(invitesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum convite gerado ainda.</p>
          ) : (
            (invitesQuery.data ?? []).map((invite) => (
              <div key={invite.id} className="rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={invite.role === "owner" ? "default" : "secondary"}>
                        {roleLabel(invite.role)}
                      </Badge>
                      {invite.used_at ? (
                        <Badge variant="outline">Utilizado</Badge>
                      ) : invite.expires_at && new Date(invite.expires_at) < new Date() ? (
                        <Badge variant="outline">Expirado</Badge>
                      ) : (
                        <Badge variant="outline">Ativo</Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      /convite/{invite.token}
                      {invite.email ? ` · ${invite.email}` : ""}
                      {invite.note ? ` · ${invite.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => copyLink(invite.token)}>
                      <Copy className="size-4" /> Copiar link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQrToken(qrToken === invite.token ? null : invite.token)}
                    >
                      <QrCode className="size-4" /> QR Code
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir convite"
                      onClick={() => removeInvite.mutate(invite.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {qrToken === invite.token ? (
                  <div className="mt-4 flex flex-col items-center gap-3 border-t border-border/60 pt-4">
                    <div className="rounded-lg bg-white p-3">
                      <QRCodeSVG id={`qr-${invite.token}`} value={inviteUrl(invite.token)} size={180} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => downloadQr(invite.token)}>
                      <Download className="size-4" /> Baixar QR Code
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
