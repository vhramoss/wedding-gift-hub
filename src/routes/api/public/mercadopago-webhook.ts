import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook do Mercado Pago.
 *
 * O status não é confiado ao navegador.
 * Quando recebemos uma notificação, consultamos novamente a API do Mercado Pago
 * antes de alterar o pedido.
 */

export const Route = createFileRoute(
  "/api/public/mercadopago-webhook",
)({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

type MercadoPagoPayment = {
  id?: number;
  status?: string;
  external_reference?: string;
};

async function handle(request: Request): Promise<Response> {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];

  if (!accessToken) {
    return new Response("Mercado Pago não configurado", {
      status: 503,
    });
  }

  let paymentId: string | null = null;

  try {
    const contentType =
      request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json();

      paymentId =
        String(
          body?.data?.id ??
            body?.data_id ??
            "",
        ) || null;
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);

      paymentId =
        params.get("data.id") ||
        params.get("data_id") ||
        params.get("id");
    }
  } catch {
    // Tentaremos obter o ID pela query string abaixo.
  }

  if (!paymentId) {
    const url = new URL(request.url);

    paymentId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id");
  }

  if (!paymentId || paymentId === "null") {
    return new Response("ok", { status: 200 });
  }

  let payment: MercadoPagoPayment | null = null;

  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        paymentId,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      // Retornamos erro para permitir nova tentativa do Mercado Pago.
      return new Response("error", { status: 500 });
    }

    payment =
      (await response.json()) as MercadoPagoPayment;
  } catch {
    return new Response("error", { status: 500 });
  }

  if (!payment?.id || !payment.external_reference) {
    return new Response("ok", { status: 200 });
  }

  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  const { data: order, error: orderError } =
    await supabaseAdmin
      .from("orders")
      .select("id, status, mp_payment_id")
      .eq("id", payment.external_reference)
      .maybeSingle();

  if (orderError) {
    return new Response("error", { status: 500 });
  }

  if (!order) {
    return new Response("ok", { status: 200 });
  }

  /**
   * Segurança adicional:
   * se o pedido já possui um pagamento MP associado, a notificação precisa
   * ser daquele mesmo pagamento.
   */
  if (
    order.mp_payment_id !== null &&
    order.mp_payment_id !== payment.id
  ) {
    return new Response("ok", { status: 200 });
  }

  /**
   * Só aqui o pedido é marcado definitivamente como pago.
   *
   * O trigger sync_gift_count existente no banco será executado quando
   * status mudar para paid e atualizará purchased_count.
   */
  if (
    payment.status === "approved" &&
    order.status !== "paid"
  ) {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        mp_payment_id: payment.id,
        provider: "mercadopago",
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .neq("status", "paid");

    if (error) {
      return new Response("error", { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
}