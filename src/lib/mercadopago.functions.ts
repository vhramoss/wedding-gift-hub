import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeCharge, type PaymentMethod } from "@/lib/br";

/**
 * Integração de pagamento real com o Mercado Pago.
 *
 * MERCADOPAGO_ACCESS_TOKEN fica somente no servidor.
 * MERCADOPAGO_PUBLIC_KEY é usada pelo Brick oficial no navegador.
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

type OrderPaymentMethod = Extract<PaymentMethod, "pix" | "debit" | "credit">;

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

  if (!host) {
    throw new Error("Não foi possível determinar a URL pública do webhook.");
  }

  return `${proto}://${host}/api/public/mercadopago-webhook`;
}

async function mpCreatePayment(
  body: Record<string, unknown>,
): Promise<MpPaymentResponse> {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"]!;

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": crypto.randomUUID(),
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

function mapStatus(status?: string): "pending" | "paid" | "cancelled" {
  if (status === "approved") return "paid";

  if (status === "rejected" || status === "cancelled") {
    return "cancelled";
  }

  return "pending";
}

/** Configuração pública repassada ao navegador. */
export const getMercadoPagoConfig = createServerFn({
  method: "GET",
}).handler(async () => ({
  enabled: enabled(),
  publicKey: process.env["MERCADOPAGO_PUBLIC_KEY"] ?? "",
}));

/**
 * Cria o pedido no servidor.
 *
 * O preço do presente é buscado diretamente do banco.
 * O navegador não pode escolher amount_cents, fee_cents ou total_cents.
 */
export const createPaymentOrder = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        giftId: z.string().uuid(),
        paymentMethod: z.enum(["pix", "debit", "credit"]),
        installments: z.number().int().min(1).max(12).default(1),
        message: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: gift, error: giftError } = await supabaseAdmin
      .from("gifts")
      .select(
        "id, wedding_id, name, price_cents, active, weddings!inner(id, published)",
      )
      .eq("id", data.giftId)
      .maybeSingle();

    if (giftError) throw giftError;

    if (!gift || !gift.active || !gift.weddings?.published) {
      throw new Error("Este presente não está disponível para pagamento.");
    }

    const paymentMethod = data.paymentMethod as OrderPaymentMethod;

    const installments =
      paymentMethod === "credit" ? data.installments : 1;

    const charge = computeCharge(
      gift.price_cents,
      paymentMethod,
      installments,
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, cpf")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        wedding_id: gift.wedding_id,
        gift_id: gift.id,
        user_id: context.userId,
        guest_name: profile?.full_name ?? "",
        guest_cpf: profile?.cpf ?? null,
        payment_method: paymentMethod,
        installments,
        amount_cents: gift.price_cents,
        fee_cents: charge.feeCents,
        total_cents: charge.totalCents,
        message: data.message?.trim() || null,
        status: "pending",
        paid_at: null,
        provider: "mercadopago",
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    return {
      orderId: order.id,
    };
  });

/**
 * Cria um pagamento Pix e devolve:
 * - QR Code copia e cola
 * - QR Code Base64, quando fornecido pelo Mercado Pago
 */
export const createPixPayment = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      orderId: z.string().uuid(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!enabled()) {
      throw new Error("Pagamento via Mercado Pago não configurado.");
    }

    const { supabase, userId, claims } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, user_id, payment_method, status, total_cents, gifts(name), weddings(commission_percent)",
      )
      .eq("id", data.orderId)
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      throw new Error("Pedido não encontrado.");
    }

    if (order.user_id !== userId) {
      throw new Error("Acesso negado ao pedido.");
    }

    if (order.payment_method !== "pix") {
      throw new Error("Pedido não é Pix.");
    }

    if (order.status !== "pending") {
      throw new Error("Pedido não está pendente.");
    }

    const commissionPercent = Number(
      order.weddings?.commission_percent ?? 0,
    );

    const commissionCents = Math.round(
      (order.total_cents * commissionPercent) / 100,
    );

    const payment = await mpCreatePayment({
      transaction_amount: order.total_cents / 100,
      description: `Presente: ${
        order.gifts?.name ?? "Lista de presentes"
      }`,
      payment_method_id: "pix",
      payer: {
        email: claims.email ?? "convidado@lista-presentes.com",
        first_name: "Convidado",
      },
      external_reference: order.id,
      notification_url: webhookUrl(),
      metadata: {
        order_id: order.id,
        commission_cents: commissionCents,
      },
    });

    const qrCode =
      payment.point_of_interaction?.transaction_data?.qr_code ?? "";

    const qrCodeBase64 =
      payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? "";

    if (!payment.id || !qrCode) {
      throw new Error(
        "O Mercado Pago não retornou os dados necessários para o Pix.",
      );
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        mp_payment_id: payment.id,
        provider: "mercadopago",
        pix_payload: qrCode,
        pix_qr_base64: qrCodeBase64 || null,
        commission_cents: commissionCents,
      })
      .eq("id", order.id)
      .eq("status", "pending");

    if (updateError) throw updateError;

    return {
      orderId: order.id,
      paymentId: payment.id,
      qrCode,
      qrCodeBase64,
    };
  });

/**
 * Processa cartão tokenizado pelo Brick oficial do Mercado Pago.
 *
 * Número, validade e CVV não são salvos pelo site.
 */
export const processCardPayment = createServerFn({
  method: "POST",
})
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
      .select(
        "id, user_id, payment_method, status, total_cents, gifts(name), weddings(commission_percent)",
      )
      .eq("id", data.orderId)
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      throw new Error("Pedido não encontrado.");
    }

    if (order.user_id !== userId) {
      throw new Error("Acesso negado ao pedido.");
    }

    if (
      order.payment_method !== "credit" &&
      order.payment_method !== "debit"
    ) {
      throw new Error("Pedido não é de cartão.");
    }

    if (order.status !== "pending") {
      throw new Error("Pedido não está pendente.");
    }

    // Débito nunca pode ser parcelado.
    const installments =
      order.payment_method === "debit" ? 1 : data.installments;

    const commissionPercent = Number(
      order.weddings?.commission_percent ?? 0,
    );

    const commissionCents = Math.round(
      (order.total_cents * commissionPercent) / 100,
    );

    const payment = await mpCreatePayment({
      transaction_amount: order.total_cents / 100,
      token: data.token,
      description: `Presente: ${
        order.gifts?.name ?? "Lista de presentes"
      }`,
      installments,
      payment_method_id: data.paymentMethodId,
      issuer_id: data.issuerId || undefined,
      payer: {
        email: claims.email ?? "convidado@lista-presentes.com",
      },
      external_reference: order.id,
      notification_url: webhookUrl(),
      metadata: {
        order_id: order.id,
        commission_cents: commissionCents,
      },
    });

    const newStatus = mapStatus(payment.status);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        mp_payment_id: payment.id ?? null,
        provider: "mercadopago",
        commission_cents: commissionCents,
        status: newStatus,
        paid_at:
          newStatus === "paid"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", order.id)
      .eq("status", "pending");

    if (updateError) throw updateError;

    return {
      status: newStatus,
      paymentId: payment.id,
      detail: payment.status_detail ?? "",
    };
  });