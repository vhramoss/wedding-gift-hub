import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { paidAmountMatches } from "@/lib/payment-rules";
import { validMercadoPagoSignature } from "@/lib/webhook-signature";

/**
 * Webhook do Mercado Pago (IPN / Webhooks API).
 * Recebe notificações de mudança de status de pagamento e confirma o pedido
 * via a função do banco `confirm_order_payment`, protegida por um segredo
 * configurado pelo super-admin. Não usa a service role key.
 *
 * O Mercado Pago envia `data.id` (ID do pagamento) — no body (webhooks JSON)
 * ou na query string (IPN). Buscamos o pagamento na API do MP para confirmar.
 */

const PAID_STATUSES = new Set(["approved"]);
const CANCELLED_STATUSES = new Set([
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
]);

function makePublishableClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("Missing Supabase environment variable(s).");
  }
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request
            ? input.headers
            : undefined,
        );
        if (init?.headers) {
          new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        }
        // Novas chaves sb_ são opacas, não JWT.
        if (
          (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) &&
          headers.get("Authorization") === `Bearer ${key}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  const confirmSecret = process.env["ORDER_CONFIRM_SECRET"];
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

  if (!paymentId || !/^\d+$/.test(paymentId)) {
    return new Response("ok", { status: 200 });
  }

  const signatureSecret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (!signatureSecret) return new Response("Assinatura do provedor não configurada", { status: 503 });
  if (!(await validMercadoPagoSignature(signatureSecret, request.headers.get("x-signature"), request.headers.get("x-request-id"), new URL(request.url).searchParams.get("data.id") ?? paymentId))) {
    return new Response("Assinatura inválida", { status: 401 });
  }

  // Buscar o pagamento na API do Mercado Pago para confirmar o status real.
  // Em pagamentos com split, a consulta usa o token da conta dos noivos
  // (o id do casamento vem na query `w` da URL de notificação).
  let payment: { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string } | null = null;
  const weddingId = new URL(request.url).searchParams.get("w");

  const tokens: string[] = [];
  if (weddingId && confirmSecret) {
    try {
      const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabase.rpc("get_wedding_mp_credentials", {
        p_wedding_id: weddingId,
        p_secret: confirmSecret,
      });
      const sellerToken = (rows ?? [])[0]?.access_token;
      if (sellerToken) tokens.push(sellerToken);
    } catch {
      // segue com o token da plataforma
    }
  }
  tokens.push(accessToken);

  for (const token of tokens) {
    try {
      const res = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        payment = await res.json();
        break;
      }
    } catch {
      // tenta o próximo token
    }
  }

  if (!payment || !payment.external_reference) {
    return new Response("ok", { status: 200 });
  }

  const orderId = payment.external_reference;
  const status = payment.status ?? "";
  const isPaid = PAID_STATUSES.has(status);
  const isCancelled = CANCELLED_STATUSES.has(status);

  if (!isPaid && !isCancelled) {
    return new Response("ok", { status: 200 });
  }

  // Confirma/cancela no banco via função protegida por segredo.
  if (!confirmSecret) {
    // Sem segredo configurado, deixa o MP tentar de novo depois.
    return new Response("Segredo do webhook não configurado", { status: 500 });
  }

  try {
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
    const { data: orderRows, error: orderError } = await supabase.rpc("public_order_status", { p_order_id: orderId });
    const order = orderRows?.[0];
    if (orderError || !order) return new Response("Pedido não encontrado", { status: 503 });
    if (weddingId && order.wedding_id !== weddingId) return new Response("Casamento divergente", { status: 409 });
    if (isPaid && !paidAmountMatches(order.cart_total_cents ?? order.total_cents, payment.transaction_amount ?? NaN, payment.currency_id ?? "")) {
      return new Response("Valor ou moeda divergente", { status: 409 });
    }
    const mpId = Number(paymentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("confirm_order_payment", {
      p_order_id: orderId,
      p_mp_payment_id: (Number.isFinite(mpId) ? mpId : null) as number,
      p_status: status,
      p_secret: confirmSecret,
    });
    if (error) {
      console.error("confirm_order_payment error", error.message);
      return new Response("error", { status: 500 });
    }
  } catch (e) {
    console.error("webhook confirm failed", e);
    return new Response("error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
