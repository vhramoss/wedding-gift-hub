import { z } from "zod";
export const PAYMENT_SERVICE_ORIGIN = "https://project--9c1a9c5e-c4b3-4bc7-9aeb-c5b9dc2a62ee.lovable.app";
export const PAYMENT_SERVICE_PATH = "/api/public/payment-service";
export const PAYMENT_SITE_ORIGIN = "https://wedding-gift-hub.vercel.app";
const method = z.enum(["pix", "debit", "credit"]);
const wedding = z.object({ weddingId: z.string().uuid() });
const buyer = { method, installments: z.number().int().min(1).max(12).default(1), message: z.string().max(500).default(""), guestName: z.string().max(120).default(""), guestEmail: z.string().max(160).default(""), guestPhone: z.string().max(40).default(""), guestCpf: z.string().max(20).default("") };
export const paymentRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("config"), data: wedding.partial().default({}) }),
  z.object({ action: z.literal("gift"), data: z.object({ ...buyer, giftId: z.string().uuid(), shares: z.number().int().min(1).max(100).default(1) }) }),
  z.object({ action: z.literal("cart"), data: z.object({ ...buyer, items: z.array(z.object({ giftId: z.string().uuid(), shares: z.number().int().min(1).max(100).default(1) })).min(1).max(30) }) }),
  z.object({ action: z.literal("pix"), data: z.object({ orderId: z.string().uuid(), payerEmail: z.string().max(160).default("") }) }),
  z.object({ action: z.literal("card"), data: z.object({ orderId: z.string().uuid(), token: z.string().min(1).max(2048), paymentMethodId: z.string().min(1).max(100), issuerId: z.string().max(100).default(""), installments: z.number().int().min(1).max(12).default(1), payerEmail: z.string().max(160).default("") }) }),
  z.object({ action: z.literal("connect-url"), data: wedding }),
  z.object({ action: z.literal("connect-complete"), data: wedding.extend({ code: z.string().min(1).max(2048) }) }),
  z.object({ action: z.literal("connect-status"), data: wedding }),
  z.object({ action: z.literal("disconnect"), data: wedding }),
]);
export type PaymentAction = z.infer<typeof paymentRequestSchema>["action"];
const encode = (text: string) => new TextEncoder().encode(text);
const manifest = (timestamp: string, body: string) => encode(`casa-comigo:payments:v1:${timestamp}:${body}`);
export async function signPaymentRequest(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, manifest(timestamp, body)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function validPaymentRequest(secret: string, timestamp: string | null, signature: string | null, body: string, now = Date.now()) {
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 60_000 || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = new Uint8Array((signature.match(/../g) ?? []).map(hex => parseInt(hex, 16)));
  return crypto.subtle.verify("HMAC", key, bytes, manifest(timestamp, body));
}
