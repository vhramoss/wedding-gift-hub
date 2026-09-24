import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/br";

/** Mostra aos noivos as taxas da plataforma aplicadas ao casamento deles. */
export function FeesTab({ weddingId }: { weddingId: string }) {
  const q = useQuery({
    queryKey: ["panel", "fees", weddingId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wedding_fee_schedule", { _wedding_id: weddingId });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  let prev = 0;
  const guestPays = rows[0]?.paid_by === "guest";

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Taxas da plataforma</CardTitle>
        <CardDescription>
          A taxa é descontada de cada presente pago, conforme o valor do presente.{" "}
          {guestPays
            ? "Neste casamento a taxa é somada ao valor pago pelo convidado."
            : "O valor que vocês recebem é o do presente menos a taxa."}{" "}
          Parcelamento no crédito tem juros pagos pelo convidado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Carregando taxas…</p>
        ) : (
          rows.map((r, i) => {
            const label =
              r.up_to_cents === null
                ? `Acima de ${formatBRL(prev)}`
                : i === 0
                  ? `Até ${formatBRL(r.up_to_cents)}`
                  : `De ${formatBRL(prev)} até ${formatBRL(r.up_to_cents)}`;
            if (r.up_to_cents !== null) prev = r.up_to_cents;
            const example = r.up_to_cents ?? prev * 2;
            return (
              <div key={i} className="flex justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span>{label}</span>
                <span>
                  <strong>{Number(r.percent)}%</strong>{" "}
                  <span className="text-muted-foreground">
                    (ex.: presente de {formatBRL(example)} → taxa {formatBRL(Math.round((example * Number(r.percent)) / 100))})
                  </span>
                </span>
              </div>
            );
          })
        )}
        <p className="pt-2 text-xs text-muted-foreground">
          Detalhes completos nos{" "}
          <Link to="/termos" className="underline">
            Termos de uso
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
