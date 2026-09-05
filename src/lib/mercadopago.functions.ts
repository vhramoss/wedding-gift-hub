import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Integração de pagamento real com o Mercado Pago.
 *
 * O dono do site é o intermediador: Pix e cartão são processados pela conta
 * do Mercado Pago do dono. O dinheiro cai na conta dele; o repasse aos noivos
 * (líquido da comissão configurada por casamento) é feito manualmente.
 *
 * Variáveis de ambiente:
 *  - MERCADOPAGO_ACCESS_TOKEN  (secret, servidor)
 *  - MERCADOPAGO_PUBLIC_KEY     (publica, navegador)
 */

type MpPaymentResponse = {
  id?: number;
  status?: string;
  status_detail?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
};

function enabled(): boolean {
  return Boolean(
    process.env["MERCADOPAGO_ACCESS_TOKEN"] &&
      process.env["MERCADOPAGO_PUBLIC_KEY"],
  );
}

function webhookUrl(): string {
  const req = getRequest();
  const headers = req?.headers ?? new Headers();
  const host =
    headers.get("x-forwarded-host") || headers.get("host") || "";
  const proto =
    headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/public/mercadopago-webhook`;
}

async function mpCreatePayment(
  body: Record<string, unknown>,
): Promise<MpPaymentResponse> {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"]!;
  const idempotency = crypto.randomUUID();
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": idempotency,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as MpPaymentResponse & {
    message?: string;
    cause?: { description?: string }[];
  };
  if (!res.ok) {
    const detail =
      data.cause?.map((c) => c.description).join("; ") ||
      data.message ||
      `Erro Mercado Pago (${res.status})`;
    throw new Error(detail);
  }
  return data;
}

/** Configuração pública repassada ao navegador (public key + status). */
export const getMercadoPagoConfig = createServerFn({ method: "GET" }).handler(
  async () => ({
    enabled: enabled(),
    publicKey: process.env["MERCADOPAGO_PUBLIC_KEY"] ?? "",
  }),
);

/** Cria um pagamento Pix e devolve o QR Code "copia e cola". */
export const createPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ orderId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!enabled()) {
      throw new Error("Pagamento via Mercado Pago não configurado.");
    }

    const { supabase, userId, claims } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, gift_id, wedding_id, user_id, payment_method, status, total_cents, gifts(name), weddings(commission_percent, bride_name, groom_name)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.user_id !== userId) throw new Error("Acesso negado ao pedido.");
    if (order.payment_method !== "pix") throw new Error("Pedido não é Pix.");
    if (order.status !== "pending") throw new Error("Pedido não está pendente.");

    const commissionPercent = Number(order.weddings?.commission_percent ?? 0);
    const commissionCents = Math.round(
      (order.total_cents * commissionPercent) / 100,
    );

    const payment = await mpCreatePayment({
      transaction_amount: order.total_cents / 100,
      description: `Presente: ${order.gifts?.name ?? "Lista de presentes"}`,
      payment_method_id: "pix",
      payer: {
        email: claims.email ?? "convidado@lista-presentes.com",
        first_name: "Convidado",
      },
      external_reference: order.id,
      notification_url: webhookUrl(),
      metadata: { order_id: order.id, commission_cents: commissionCents },
    });

    const qrCode = payment.point_of_interaction?.transaction_data?.qr_code ?? "";
    const qrCodeBase64 =
      payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? "";

    const { error: updError } = await supabase
      .from("orders")
      .update({
        mp_payment_id: payment.id ?? null,
        provider: "mercadopago",
        pix_payload: qrCode,
        pix_qr_base64: qrCodeBase64,
        commission_cents: commissionCents,
      })
      .eq("id", order.id);

    if (updError) throw updError;

    return { paymentId: payment.id, qrCode, qrCodeBase64 };
  });

/** Processa um pagamento com cartão tokenizado pelo brick do Mercado Pago. */
export const processCardPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        token: z.string().min(1),
        paymentMethodId: z.string().min(1),
        issuerId: z.string().optional().default(""),
        installments: z.number().int().min(1).max(12).default(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!enabled()) {
      throw new Error("Pagamento via Mercado Pago não configurado.");
    }

    const { supabase, userId, claims } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, gift_id, wedding_id, user_id, payment_method, status, total_cents, gifts(name), weddings(commission_percent)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.user_id !== userId) throw new Error("Acesso negado ao pedido.");
    if (order.payment_method !== "credit" && order.payment_method !== "debit")
      throw new Error("Pedido não é de cartão.");
    if (order.status !== "pending") throw new Error("Pedido não está pendente.");

    const commissionPercent = Number(order.weddings?.commission_percent ?? 0);
    const commissionCents = Math.round(
      (order.total_cents * commissionPercent) / 100,
    );

    const payment = await mpCreatePayment({
      transaction_amount: order.total_cents / 100,
      token: data.token,
      description: `Presente: ${order.gifts?.name ?? "Lista de presentes"}`,
      installments: data.installments,
      payment_method_id: data.paymentMethodId,
      issuer_id: data.issuerId || undefined,
      payer: {
        email: claims.email ?? "convidado@lista-presentes.com",
      },
      external_reference: order.id,
      notification_url: webhookUrl(),
      metadata: { order_id: order.id, commission_cents: commissionCents },
    });

    const mapStatus = (s?: string): "pending" | "paid" | "cancelled" => {
      if (s === "approved") return "paid";
      if (s === "rejected" || s === "cancelled") return "cancelled";
      return "pending";
    };
    const newStatus = mapStatus(payment.status);

    const { error: updError } = await supabase
      .from("orders")
      .update({
        mp_payment_id: payment.id ?? null,
        provider: "mercadopago",
        commission_cents: commissionCents,
        status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", order.id);
    if (updError) throw updError;

    return {
      status: newStatus,
      paymentId: payment.id,
      detail: payment.status_detail ?? "",
    };
  });
