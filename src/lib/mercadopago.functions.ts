import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaymentMethod } from "@/lib/br";

/**
 * Integração de pagamento real com o Mercado Pago (dono do site = intermediador).
 *
 * Refatorado para NÃO usar a SUPABASE_SERVICE_ROLE_KEY:
 *  - createGiftOrder -> RPC create_gift_order (valores derivados no banco)
 *  - createPixPayment -> RPC record_pix_payment (guarda QR + comissão)
 *  - processCardPayment -> chama MP e confirma via RPC confirm_order_payment
 *  - webhook -> RPC confirm_order_payment (segredo do super-admin)
 *
 * Regras de segurança:
 *  - O navegador NUNCA envia valores. Só giftId, método, parcelas e recado.
 *  - Nenhum dado de cartão passa pelo servidor (brick do MP tokeniza).
 *  - O pedido só vira "pago" quando o Mercado Pago confirma.
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
  // Mercado Pago exige uma URL pública válida. Em localhost (preview/dev)
  // o webhook não seria alcançável mesmo assim, então omitimos.
  if (!host || host.startsWith("localhost") || host.startsWith("127.")) {
    return "";
  }
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

/**
 * Cria o pedido pendente no servidor, via função do banco. O navegador não envia
 * valores — o preço e as taxas são derivados dentro de create_gift_order (SQL).
 */
export const createGiftOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        giftId: z.string().uuid(),
        method: z.enum(["pix", "debit", "credit"]),
        installments: z.number().int().min(1).max(12).default(1),
        message: z.string().max(500).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("create_gift_order", {
      p_gift_id: data.giftId,
      p_method: data.method,
      p_installments: data.installments,
      p_message: data.message,
    });
    if (error) throw error;
    const row = (result ?? []) as {
      order_id: string;
      total_cents: number;
      installments: number;
    }[];
    if (!row[0]) throw new Error("Não foi possível criar o pedido.");
    return {
      orderId: row[0].order_id,
      totalCents: row[0].total_cents,
      installments: row[0].installments,
    };
  });

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
      .select("id, gift_id, wedding_id, user_id, payment_method, status, total_cents, gifts(name)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.user_id !== userId) throw new Error("Acesso negado ao pedido.");
    if (order.payment_method !== "pix") throw new Error("Pedido não é Pix.");
    if (order.status !== "pending") throw new Error("Pedido não está pendente.");

    const payment = await mpCreatePayment({
      transaction_amount: order.total_cents / 100,
      description: `Presente: ${order.gifts?.name ?? "Lista de presentes"}`,
      payment_method_id: "pix",
      payer: {
        email: claims.email ?? "convidado@lista-presentes.com",
        first_name: "Convidado",
      },
      external_reference: order.id,
      ...(webhookUrl() ? { notification_url: webhookUrl() } : {}),
    });

    const qrCode = payment.point_of_interaction?.transaction_data?.qr_code ?? "";
    const qrCodeBase64 =
      payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? "";

    const { error: rpcError } = await supabase.rpc("record_pix_payment", {
      p_order_id: order.id,
      p_mp_payment_id: (payment.id ?? null) as number,
      p_payload: qrCode,
      p_qr_base64: qrCodeBase64,
    });
    if (rpcError) throw rpcError;

    return {
      paymentId: payment.id,
      qrCode,
      qrCodeBase64,
      totalCents: order.total_cents,
    };
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
      .select("id, gift_id, wedding_id, user_id, payment_method, status, total_cents, installments, gifts(name)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.user_id !== userId) throw new Error("Acesso negado ao pedido.");
    if (order.payment_method !== "credit" && order.payment_method !== "debit")
      throw new Error("Pedido não é de cartão.");
    if (order.status !== "pending") throw new Error("Pedido não está pendente.");

    // Débito sempre à vista; crédito usa o parcelamento gravado no pedido.
    const installments =
      order.payment_method === "debit" ? 1 : (order.installments ?? 1);

    const payment = await mpCreatePayment({
      transaction_amount: order.total_cents / 100,
      token: data.token,
      description: `Presente: ${order.gifts?.name ?? "Lista de presentes"}`,
      installments,
      payment_method_id: data.paymentMethodId,
      issuer_id: data.issuerId || undefined,
      payer: {
        email: claims.email ?? "convidado@lista-presentes.com",
      },
      external_reference: order.id,
      ...(webhookUrl() ? { notification_url: webhookUrl() } : {}),
    });

    const mapStatus = (s?: string): "pending" | "paid" | "cancelled" => {
      if (s === "approved") return "paid";
      if (s === "rejected" || s === "cancelled") return "cancelled";
      return "pending";
    };
    const newStatus = mapStatus(payment.status);

    // Confirma no banco via função protegida por segredo (mesmo segredo do webhook).
    // Best-effort: se o segredo ainda não foi configurado, o webhook fará a confirmação.
    const secret = process.env["ORDER_CONFIRM_SECRET"];
    if (secret) {
      try {
        await supabase.rpc("confirm_order_payment", {
          p_order_id: order.id,
          p_mp_payment_id: (payment.id ?? null) as number,
          p_status: payment.status ?? "",
          p_secret: secret,
        });
      } catch {
        // log e segue — o webhook confirma posteriormente
        console.error("confirm_order_payment falhou (cartão); webhook fará a confirmação.");
      }
    }

    return {
      status: newStatus,
      paymentId: payment.id,
      detail: payment.status_detail ?? "",
    };
  });

/** Permite ao super-admin definir o segredo do webhook. */
export const setOrderConfirmSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ secret: z.string().min(16).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_order_confirm_secret", {
      p_secret: data.secret,
    });
    if (error) throw error;
    return { ok: true };
  });

/** Indica (sem revelar) se o segredo do webhook já foi configurado. */
export const getOrderConfirmSecretSet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc(
      "order_confirm_secret_is_set",
    );
    if (error) throw error;
    return { set: Boolean(data) };
  });
