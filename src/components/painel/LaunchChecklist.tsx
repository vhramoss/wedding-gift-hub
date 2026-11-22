import { CheckCircle2, Circle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function LaunchChecklist({ weddingId, hasDetails, hasGifts, approved, onSelect }: { weddingId: string; hasDetails: boolean; hasGifts: boolean; approved: boolean; onSelect: (section: string, tab: string) => void }) {
  const query = useQuery({
    queryKey: ["panel", "launch", weddingId],
    queryFn: async () => {
      const [payment, guests, invites] = await Promise.all([
        supabase.rpc("wedding_payment_status", { _wedding_id: weddingId }),
        supabase.from("wedding_guests").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId),
        supabase.from("wedding_invites").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId).not("guest_id", "is", null),
      ]);
      if (payment.error || guests.error || invites.error) throw payment.error ?? guests.error ?? invites.error;
      return { connected: Boolean(payment.data?.[0]?.connected), guests: (guests.count ?? 0) > 0, invites: (invites.count ?? 0) > 0 };
    },
  });
  const steps = [
    { label: "Dados do casamento", done: hasDetails, section: "site", tab: "content" },
    { label: "Conectar recebimento", done: query.data?.connected, section: "money", tab: "payments" },
    { label: "Adicionar presentes", done: hasGifts, section: "money", tab: "gifts" },
    { label: "Cadastrar convidados", done: query.data?.guests, section: "guests", tab: "rsvps" },
    { label: "Criar convites individuais", done: query.data?.invites, section: "guests", tab: "rsvps" },
    { label: "Liberação para compartilhar", done: approved, section: "site", tab: "content" },
  ];
  return <section className="mt-8 border-y py-5"><h2 className="text-xl font-semibold">Preparar nosso site</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{steps.map((step) => <Button key={step.label} variant="ghost" className="h-auto justify-start whitespace-normal text-left" onClick={() => onSelect(step.section, step.tab)}>{step.done ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}{step.label}</Button>)}</div></section>;
}