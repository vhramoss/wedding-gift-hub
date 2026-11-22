import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMpConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weddingId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ url: string }>("connect-url", data);
  });

export const completeMpConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(1), weddingId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ ok: boolean; mpUserId: number | null; liveMode: boolean }>("connect-complete", data);
  });

export const getWeddingPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weddingId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ configured: boolean; connected: boolean; mpUserId: number | null; liveMode: boolean | null; connectedAt: string | null }>("connect-status", data);
  });

export const disconnectWeddingMp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weddingId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ ok: boolean }>("disconnect", data);
  });
