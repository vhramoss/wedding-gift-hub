import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Conexão da conta Mercado Pago dos noivos (modelo marketplace / split).
 *
 * Fluxo:
 *  1. Noivos clicam em "Conectar conta" -> redirecionados para o Mercado Pago (OAuth).
 *  2. MP volta para /conectar-pagamento?code=...&state=<weddingId>.
 *  3. O servidor troca o code por access_token/refresh_token da conta DELES.
 *  4. Ao pagar um presente, a cobrança é criada com o token dos noivos e
 *     `application_fee` = comissão da plataforma. O MP divide na liquidação:
 *     líquido -> conta dos noivos; comissão -> conta da plataforma.
 */

async function assertCanManage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  weddingId: string,
) {
  const { data: owns } = await supabase.rpc("owns_wedding", {
    _wedding_id: weddingId,
  });
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!owns && !isAdmin) throw new Error("Acesso negado.");
}

/** Monta a URL de autorização do Mercado Pago para o casamento informado. */
export const getMpConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weddingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const mp = await import("@/lib/mp-oauth.server");
    if (!mp.oauthConfigured()) {
      throw new Error(
        "Conexão de contas ainda não configurada. Falta cadastrar o aplicativo do Mercado Pago.",
      );
    }
    await assertCanManage(context.supabase, context.userId, data.weddingId);
    return { url: mp.authorizationUrl(data.weddingId) };
  });

/** Conclui a conexão: troca o code pelo token da conta dos noivos e guarda. */
export const completeMpConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ code: z.string().min(1), weddingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const mp = await import("@/lib/mp-oauth.server");
    if (!mp.oauthConfigured()) throw new Error("Conexão de contas não configurada.");
    const secret = process.env["ORDER_CONFIRM_SECRET"];
    if (!secret) throw new Error("Segredo interno não configurado.");

    await assertCanManage(context.supabase, context.userId, data.weddingId);

    const token = await mp.exchange({
      grant_type: "authorization_code",
      code: data.code,
      redirect_uri: mp.redirectUri(),
    });

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

    const { error } = await context.supabase.rpc("save_wedding_mp_account", {
      p_wedding_id: data.weddingId,
      p_mp_user_id: (token.user_id ?? null) as number,
      p_access_token: token.access_token!,
      p_refresh_token: token.refresh_token ?? "",
      p_public_key: token.public_key ?? "",
      p_expires_at: expiresAt as string,
      p_live_mode: token.live_mode ?? true,
      p_connected_by: context.userId,
      p_secret: secret,
    });
    if (error) throw error;

    return { ok: true, mpUserId: token.user_id ?? null, liveMode: token.live_mode ?? true };
  });

/** Status da conexão (sem expor credenciais). */
export const getWeddingPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weddingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const mp = await import("@/lib/mp-oauth.server");
    const { data: rows, error } = await context.supabase.rpc(
      "wedding_payment_status",
      { _wedding_id: data.weddingId },
    );
    if (error) throw error;
    const row = (rows ?? [])[0];
    return {
      configured: mp.oauthConfigured(),
      connected: Boolean(row?.connected),
      mpUserId: row?.mp_user_id ?? null,
      liveMode: row?.live_mode ?? null,
      connectedAt: row?.connected_at ?? null,
    };
  });

/** Desconecta a conta de recebimento do casamento. */
export const disconnectWeddingMp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weddingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("disconnect_wedding_mp", {
      _wedding_id: data.weddingId,
    });
    if (error) throw error;
    return { ok: true };
  });
