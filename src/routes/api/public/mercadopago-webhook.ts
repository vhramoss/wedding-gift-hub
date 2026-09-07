import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook do Mercado Pago (IPN / Webhooks API).
 * Recebe notificações de mudança de status de pagamento e marca o pedido como
 * pago quando o pagamento for aprovado.
 *
 * O Mercado Pago envia `data.id` (ID do pagamento) — no body (webhooks JSON)
 * ou na query string (IPN). Buscamos o pagamento na API do MP para confirmar.
 */

const PAID_STATUSES = new Set(["approved"]);
const CANCELLED_STATUSES = new Set(["rejected", "cancelled", "refunded", "charged_back"]);

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return handle(request);
      },
      GET: async ({ request }) => {
        return handle(request);
      },
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!accessToken) {
    return new Response("Mercado Pago não configurado", { status: 503 });
  }

  let paymentId: string | null = null;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      paymentId = String(body?.data?.id ?? body?.data_id ?? "") || null;
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      paymentId =
        params.get("data.id") || params.get("data_id") || params.get("id");
    }
  } catch {
    // ignore parse errors
  }

  // Fallback: IPN via query string
  if (!paymentId) {
    const url = new URL(request.url);
    paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
  }

  if (!paymentId || paymentId === "null") {
    // Acknowledge so MP stops retrying
    return new Response("ok", { status: 200 });
  }

  // Buscar o pagamento na API do Mercado Pago para confirmar o status
  let payment: {
    status?: string;
    external_reference?: string;
  } | null = null;

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.ok) payment = await res.json();
  } catch {
    // network error — let MP retry
    return new Response("error", { status: 500 });
  }

  if (!payment || !payment.external_reference) {
    return new Response("ok", { status: 200 });
  }

  const orderId = payment.external_reference;
  const status = payment.status ?? "";
  const isPaid = PAID_STATUSES.has(status);
  const isCancelled = CANCELLED_STATUSES.has(status);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return new Response("ok", { status: 200 });

  // Idempotente: só grava quando o status realmente muda.
  if (isPaid && order.status !== "paid") {
    await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        mp_payment_id: Number(paymentId) || null,
        provider: "mercadopago",
      })
      .eq("id", orderId);
  } else if (isCancelled && order.status === "pending") {
    await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);
  }

  return new Response("ok", { status: 200 });
}

// Referência para silenciar import não usado em alguns bundlers
void createHmac;
void timingSafeEqual;
