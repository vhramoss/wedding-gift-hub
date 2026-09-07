import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

  if (!paymentId || paymentId === "null") {
    return new Response("ok", { status: 200 });
  }

  // Buscar o pagamento na API do Mercado Pago para confirmar o status real.
  let payment: { status?: string; external_reference?: string } | null = null;

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.ok) payment = await res.json();
  } catch {
    return new Response("error", { status: 500 });
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
    const supabase = makePublishableClient();
    const mpId = Number(paymentId);
    const { error } = await supabase.rpc("confirm_order_payment", {
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
