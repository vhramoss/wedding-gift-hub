import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWedding(slug: string) {
  return useQuery({
    queryKey: ["wedding", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function formatWeddingDate(date: string | null | undefined) {
  if (!date) return null;
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "long" });
}

export function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00`).getTime();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86_400_000);
}

/** Ainda dá tempo de confirmar ou desconfirmar presença? */
export function isRsvpOpen(deadline: string | null | undefined) {
  if (!deadline) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${deadline}T23:59:59`).getTime() >= today.getTime();
}

/** Contagem regressiva detalhada até a data do casamento. */
export function countdownParts(date: string | null | undefined, time?: string | null) {
  if (!date) return null;
  const clock = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : "12:00";
  const target = new Date(`${date}T${clock}:00`).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    past: false,
  };
}
