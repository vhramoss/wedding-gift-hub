import { getRequest } from "@tanstack/react-start/server";

/** Helpers server-only da conexão OAuth com o Mercado Pago (marketplace/split). */

export function oauthConfigured(): boolean {
  return Boolean(
    process.env["MERCADOPAGO_CLIENT_ID"] &&
      process.env["MERCADOPAGO_CLIENT_SECRET"],
  );
}

function origin(): string {
  const headers = getRequest()?.headers ?? new Headers();
  const host = headers.get("x-forwarded-host") || headers.get("host") || "";
  const proto =
    headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}

export function redirectUri(): string {
  return `${origin()}/conectar-pagamento`;
}

export type MpTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  public_key?: string;
  expires_in?: number;
  user_id?: number;
  live_mode?: boolean;
  message?: string;
  error?: string;
};

export async function exchange(
  body: Record<string, unknown>,
): Promise<MpTokenResponse> {
  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env["MERCADOPAGO_CLIENT_ID"],
      client_secret: process.env["MERCADOPAGO_CLIENT_SECRET"],
      ...body,
    }),
  });
  const data = (await res.json()) as MpTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.message ||
        data.error ||
        `Falha ao conectar com o Mercado Pago (${res.status})`,
    );
  }
  return data;
}

/** Renova o token de uma conta conectada (usado quando expira). */
export async function refreshSellerToken(
  refreshToken: string,
): Promise<MpTokenResponse> {
  return exchange({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** URL de autorização do Mercado Pago para o casamento informado. */
export function authorizationUrl(weddingId: string): string {
  const params = new URLSearchParams({
    client_id: process.env["MERCADOPAGO_CLIENT_ID"]!,
    response_type: "code",
    platform_id: "mp",
    state: weddingId,
    redirect_uri: redirectUri(),
  });
  return `https://auth.mercadopago.com/authorization?${params.toString()}`;
}
