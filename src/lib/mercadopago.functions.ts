import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Integração de pagamento real com o Mercado Pago.
 *
 * Modelo marketplace (split de pagamento):
 *  - Se o casamento tem conta Mercado Pago conectada, a cobrança é criada com o
 *    token DOS NOIVOS e `application_fee` = comissão da plataforma. O Mercado
 *    Pago divide na liquidação: líquido -> conta dos noivos, comissão -> conta
 *    da plataforma. O dinheiro dos noivos nunca entra no caixa da plataforma.
 *  - Sem conta conectada, cai no modo antigo (tudo na conta da plataforma).
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

function webhookUrl(weddingId?: string): string {
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
  const base = `${proto}://${host}/api/public/mercadopago-webhook`;
  return weddingId ? `${base}?w=${weddingId}` : base;
}

async function mpCreatePayment(
  body: Record<string, unknown>,
  accessToken: string,
): Promise<MpPaymentResponse> {
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

/**
 * Resolve qual conta recebe o pagamento.
 * Retorna o token da conta dos noivos (split) ou o da plataforma (fallback).
 */
async function resolveCollector(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  weddingId: string,
  totalCents: number,
): Promise<{
  accessToken: string;
  split: boolean;
  applicationFeeCents: number;
  sellerMpUserId: number | null;
}> {
  const platform = {
    accessToken: process.env["MERCADOPAGO_ACCESS_TOKEN"]!,
    split: false,
    applicationFeeCents: 0,
    sellerMpUserId: null as number | null,
  };
  const secret = process.env["ORDER_CONFIRM_SECRET"];
  if (!secret) return platform;

  const { data: rows, error } = await supabase.rpc("get_wedding_mp_credentials", {
    p_wedding_id: weddingId,
    p_secret: secret,
  });
  if (error) return platform;
  const cred = (rows ?? [])[0] as
    | {
        mp_user_id: number | null;
        access_token: string;
        refresh_token: string | null;
        expires_at: string | null;
      }
    | undefined;
  if (!cred?.access_token) return platform;

  let accessToken = cred.access_token;

  // Renova o token se estiver expirado (ou perto disso).
  const expiresAt = cred.expires_at ? new Date(cred.expires_at).getTime() : 0;
  if (cred.refresh_token && expiresAt && expiresAt - Date.now() < 60_000) {
    try {
      const { refreshSellerToken } = await import("@/lib/mp-oauth.server");
      const fresh = await refreshSellerToken(cred.refresh_token);
      accessToken = fresh.access_token!;
      await supabase.rpc("save_wedding_mp_account", {
        p_wedding_id: weddingId,
        p_mp_user_id: (fresh.user_id ?? cred.mp_user_id ?? null) as number,
        p_access_token: fresh.access_token!,
        p_refresh_token: fresh.refresh_token ?? "",
        p_public_key: fresh.public_key ?? "",
        p_expires_at: (fresh.expires_in
          ? new Date(Date.now() + fresh.expires_in * 1000).toISOString()
          : null) as string,
        p_live_mode: fresh.live_mode ?? true,
        p_connected_by: null as unknown as string,
        p_secret: secret,
      });
    } catch {
      // segue com o token atual; se falhar, o MP devolverá erro claro
    }
  }

  // Comissão da plataforma definida por casamento.
  const { data: wedding } = await supabase
    .from("weddings")
    .select("commission_percent")
    .eq("id", weddingId)
    .maybeSingle();
  const pct = Number(wedding?.commission_percent ?? 0);
  const fee = Math.max(0, Math.round((totalCents * pct) / 100));

  return {
    accessToken,
    split: true,
    applicationFeeCents: fee,
    sellerMpUserId: cred.mp_user_id ?? null,
  };
}

async function recordSplit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orderId: string,
  applicationFeeCents: number,
  sellerMpUserId: number | null,
) {
  const secret = process.env["ORDER_CONFIRM_SECRET"];
  if (!secret) return;
  try {
    await supabase.rpc("record_order_split", {
      p_order_id: orderId,
      p_application_fee_cents: applicationFeeCents,
      p_seller_mp_user_id: sellerMpUserId as number,
      p_secret: secret,
    });
  } catch {
    console.error("record_order_split falhou");
  }
}

/** Configuração pública repassada ao navegador (public key + status). */
export const getMercadoPagoConfig = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ weddingId: z.string().uuid().optional() })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const platformKey = process.env["MERCADOPAGO_PUBLIC_KEY"] ?? "";
    let publicKey = platformKey;
    let split = false;

    if (data?.weddingId) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (url && key) {
          const client = createClient(url, key, {
            auth: { persistSession: false },
            global: {
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                if (h.get("Authorization") === `Bearer ${key}`) {
                  h.delete("Authorization");
                }
                h.set("apikey", key);
                return fetch(input, { ...init, headers: h });
              },
            },
          });
          const { data: sellerKey } = await client.rpc(
            "wedding_payment_public_key",
            { _wedding_id: data.weddingId },
          );
          if (sellerKey) {
            publicKey = sellerKey as string;
            split = true;
          }
        }
      } catch {
        // mantém a chave da plataforma
      }
    }

    return { enabled: enabled(), publicKey, split };
  });

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

    const collector = await resolveCollector(
      supabase,
      order.wedding_id,
      order.total_cents,
    );

    const payment = await mpCreatePayment(
      {
        transaction_amount: order.total_cents / 100,
        description: `Presente: ${order.gifts?.name ?? "Lista de presentes"}`,
        payment_method_id: "pix",
        payer: {
          email: claims.email ?? "convidado@lista-presentes.com",
          first_name: "Convidado",
        },
        external_reference: order.id,
        ...(collector.split && collector.applicationFeeCents > 0
          ? { application_fee: collector.applicationFeeCents / 100 }
          : {}),
        ...(webhookUrl() 
          ? { notification_url: webhookUrl(collector.split ? order.wedding_id : undefined) }
          : {}),
      },
      collector.accessToken,
    );

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

    if (collector.split) {
      await recordSplit(
        supabase,
        order.id,
        collector.applicationFeeCents,
        collector.sellerMpUserId,
      );
    }

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

    const collector = await resolveCollector(
      supabase,
      order.wedding_id,
      order.total_cents,
    );

    const payment = await mpCreatePayment(
      {
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
        ...(collector.split && collector.applicationFeeCents > 0
          ? { application_fee: collector.applicationFeeCents / 100 }
          : {}),
        ...(webhookUrl() 
          ? { notification_url: webhookUrl(collector.split ? order.wedding_id : undefined) }
          : {}),
      },
      collector.accessToken,
    );

    if (collector.split) {
      await recordSplit(
        supabase,
        order.id,
        collector.applicationFeeCents,
        collector.sellerMpUserId,
      );
    }

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
