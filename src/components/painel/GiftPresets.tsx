import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/br";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GiftPreset {
  name: string;
  priceCents: number;
  description: string;
}

const GIFT_PRESETS: GiftPreset[] = [
  {
    name: "Lenço da noiva",
    priceCents: 5000,
    description: "Para enxugar as lágrimas no 'sim' (e as da mãe dela também).",
  },
  {
    name: "Cueca da sorte do noivo",
    priceCents: 4500,
    description: "Porque a partir de agora alguém precisa cuidar disso por ele.",
  },
  {
    name: "Kit anti-DR",
    priceCents: 8000,
    description: "Vale uma discussão de relacionamento evitada. Uso único por briga.",
  },
  {
    name: "Primeira pizza do casamento",
    priceCents: 10000,
    description: "Porque cozinhar junto só depois da lua de mel. Ou nunca.",
  },
  {
    name: "Um mês de streaming",
    priceCents: 6000,
    description: "Para as maratonas de série a dois. O cobertor vai por conta deles.",
  },
  {
    name: "Gasolina da fuga",
    priceCents: 20000,
    description: "Caso o noivo pense em fugir do altar. Brincadeira. Ou não.",
  },
  {
    name: "Kit sobrevivência da lua de mel",
    priceCents: 18000,
    description: "Protetor solar, óculos escuros e muita paciência no porta-malas.",
  },
  {
    name: "Um ano sem lavar louça",
    priceCents: 30000,
    description: "Vale 365 dias de descanso da pia. Resultados podem variar.",
  },
  {
    name: "Seguro contra sogra",
    priceCents: 7500,
    description: "Cobertura total para visitas surpresa aos domingos.",
  },
  {
    name: "Kit primeira briga",
    priceCents: 13000,
    description: "Inclui dois travesseiros: um para a cama e um para o sofá.",
  },
  {
    name: "Jantar de reconciliação",
    priceCents: 22000,
    description: "Para depois da primeira briga. Ou da segunda. Ou da terceira.",
  },
  {
    name: "Passe de um dia sem futebol",
    priceCents: 9500,
    description: "O noivo troca o jogo de domingo por um passeio romântico. Uma vez só, hein.",
  },
  {
    name: "Vale faxina",
    priceCents: 14000,
    description: "Uma faxina completa na casa nova. Quem limpa é vocês dois, tá?",
  },
  {
    name: "Despertador do noivo",
    priceCents: 5500,
    description: "Para ele nunca mais se atrasar. Começando pelo próprio casamento.",
  },
  {
    name: "Terapia de casal preventiva",
    priceCents: 25000,
    description: "Primeira sessão garantida. Melhor prevenir do que dividir o guarda-roupa.",
  },
];

export function GiftPresets({ weddingId }: { weddingId: string }) {
  const queryClient = useQueryClient();

  const addPreset = useMutation({
    mutationFn: async (preset: GiftPreset) => {
      const { error } = await supabase.from("gifts").insert({
        wedding_id: weddingId,
        name: preset.name,
        description: preset.description,
        category: "Brincadeiras",
        price_cents: preset.priceCents,
        quantity: 1,
        shares_total: 1,
      });
      if (error) throw error;
    },
    onSuccess: (_data, preset) => {
      toast.success(`"${preset.name}" adicionado à lista!`);
      queryClient.invalidateQueries({ queryKey: ["panel", "gifts", weddingId] });
    },
    onError: (e: Error) => toast.error("Erro ao adicionar", { description: e.message }),
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="size-5 text-primary" /> Modelos prontos com brincadeiras
        </CardTitle>
        <CardDescription>
          Presentes divertidos já prontos: é só clicar para adicionar à lista. Depois vocês podem
          remover ou cadastrar outros pelo formulário abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GIFT_PRESETS.map((preset) => (
            <div
              key={preset.name}
              className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium leading-snug">{preset.name}</h3>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {formatBRL(preset.priceCents)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{preset.description}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                disabled={addPreset.isPending}
                onClick={() => addPreset.mutate(preset)}
              >
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
