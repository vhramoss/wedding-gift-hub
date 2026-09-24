import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Gera o link para o cerimonialista se cadastrar no casamento (noivos ou super admin). */
export function PlannerInviteCard({ weddingId }: { weddingId: string }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const current = useQuery({
    queryKey: ["planner", "current", weddingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("weddings")
        .select("planner_name, planner_user_id")
        .eq("id", weddingId)
        .maybeSingle();
      return data;
    },
  });

  async function generate() {
    setLoading(true);
    const { data, error } = await supabase.rpc("create_planner_invite", { _wedding_id: weddingId });
    setLoading(false);
    if (error) {
      toast.error("Não deu para gerar", { description: error.message });
      return;
    }
    setLink(`${window.location.origin}/cerimonialista/${data}`);
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Convite para o cerimonialista</CardTitle>
        <CardDescription>
          {current.data?.planner_user_id
            ? `Cerimonialista cadastrado: ${current.data.planner_name ?? "sem nome"}. Gere um novo link para trocar.`
            : "Gere um link e envie ao cerimonialista. Ele cria a conta, informa a chave Pix e fica ligado a este casamento."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={generate} disabled={loading}>
          {loading ? "Gerando..." : "Gerar link do cerimonialista"}
        </Button>
        {link ? (
          <div className="space-y-2">
            <p className="break-all rounded-md bg-secondary/50 p-2 text-sm">{link}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="size-4" /> Copiar
              </Button>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Olá! Este é o convite para você ser o cerimonialista do nosso casamento: ${link}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" /> Enviar no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
