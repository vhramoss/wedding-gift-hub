import { useQuery } from "@tanstack/react-query";
import { Download, UserCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadCsv } from "@/lib/csv";

function maskCpf(cpf: string) {
  return cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;
}

/** Quem já criou o perfil pelo convite / QR Code (separado da lista fechada). */
export function GuestSignupsCard({ weddingId }: { weddingId: string }) {
  const q = useQuery({
    queryKey: ["panel", "signups", weddingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_guest_signups")
        .select("id, full_name, cpf, guest_id, created_at")
        .eq("wedding_id", weddingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-2xl">
          <UserCheck className="size-5 text-accent" /> Perfis criados pelo convite
        </CardTitle>
        <CardDescription>
          Quem abriu o QR Code e se cadastrou com nome e CPF. Essa lista é só para acompanhamento:
          para confirmar presença, o CPF precisa estar na lista de convidados acima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              "perfis-criados.csv",
              ["Nome", "CPF", "Está na lista?", "Cadastro"],
              rows.map((r) => [
                r.full_name,
                maskCpf(r.cpf),
                r.guest_id ? "Sim" : "Não",
                new Date(r.created_at).toLocaleDateString("pt-BR"),
              ]),
            )
          }
        >
          <Download className="size-4" /> Exportar planilha
        </Button>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém criou perfil ainda.</p>
        ) : (
          <div className="divide-y divide-border/60 rounded-lg border border-border/60">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {r.full_name} <span className="text-muted-foreground">· {maskCpf(r.cpf)}</span>
                </span>
                {r.guest_id ? (
                  <Badge variant="secondary">Na lista</Badge>
                ) : (
                  <Badge variant="outline">Fora da lista</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
