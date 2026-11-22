import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMercadoPagoConfig = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ weddingId: z.string().uuid().optional() }).optional().parse(data ?? {}))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ enabled: boolean; publicKey: string; split: boolean }>("config", data);
  });

export const createGiftOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    giftId: z.string().uuid(), method: z.enum(["pix", "debit", "credit"]),
    installments: z.number().int().min(1).max(12).default(1), shares: z.number().int().min(1).max(100).default(1),
    message: z.string().max(500).optional().default(""), guestName: z.string().max(120).optional().default(""),
    guestEmail: z.string().max(160).optional().default(""), guestPhone: z.string().max(40).optional().default(""), guestCpf: z.string().max(20).optional().default("")
  }).parse(data))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ orderId: string; totalCents: number; installments: number }>("gift", data);
  });

export const createCartOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    items: z.array(z.object({ giftId: z.string().uuid(), shares: z.number().int().min(1).max(100).default(1) })).min(1).max(30),
    method: z.enum(["pix", "debit", "credit"]), installments: z.number().int().min(1).max(12).default(1),
    message: z.string().max(500).optional().default(""), guestName: z.string().max(120).optional().default(""),
    guestEmail: z.string().max(160).optional().default(""), guestPhone: z.string().max(40).optional().default(""), guestCpf: z.string().max(20).optional().default("")
  }).parse(data))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ cartId: string; orderId: string; totalCents: number; installments: number }>("cart", data);
  });

export const createPixPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ orderId: z.string().uuid(), payerEmail: z.string().max(160).optional().default("") }).parse(data))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ paymentId: number | undefined; qrCode: string; qrCodeBase64: string; totalCents: number }>("pix", data);
  });

export const processCardPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    orderId: z.string().uuid(), token: z.string().min(1), paymentMethodId: z.string().min(1), issuerId: z.string().optional().default(""),
    installments: z.number().int().min(1).max(12).default(1), payerEmail: z.string().max(160).optional().default("")
  }).parse(data))
  .handler(async ({ data }) => {
    const { relayPayment } = await import("./payment-service.server");
    return relayPayment<{ status: "paid" | "pending" | "cancelled"; paymentId: number | undefined; detail: string }>("card", data);
  });

export const setOrderConfirmSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ secret: z.string().min(16).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_order_confirm_secret", { p_secret: data.secret });
    if (error) throw error;
    return { ok: true };
  });

export const getOrderConfirmSecretSet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("order_confirm_secret_is_set");
    if (error) throw error;
    return { set: Boolean(data) };
  });
