import { getRequest } from "@tanstack/react-start/server";
import { PAYMENT_SERVICE_ORIGIN, PAYMENT_SERVICE_PATH, PAYMENT_SITE_ORIGIN, signPaymentRequest, type PaymentAction } from "./payment-service";

export async function relayPayment<T>(action: PaymentAction, data: unknown): Promise<T> {
  const secret = process.env["ORDER_CONFIRM_SECRET"];
  if (!secret) throw new Error("A conexão protegida dos pagamentos não está configurada nesta hospedagem.");
  const authorization = getRequest().headers.get("authorization") ?? "";
  const body = JSON.stringify({ action, data: data ?? {}, authorization, siteOrigin: PAYMENT_SITE_ORIGIN });
  const timestamp = String(Date.now());
  const signature = await signPaymentRequest(secret, timestamp, body);
  const response = await fetch(`${PAYMENT_SERVICE_ORIGIN}${PAYMENT_SERVICE_PATH}`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/json", "X-Payment-Time": timestamp, "X-Payment-Signature": signature, "X-Payment-Site-Origin": PAYMENT_SITE_ORIGIN, ...(authorization ? { Authorization: authorization } : {}) }, body,
  });
  if (!response.ok) {
    let message = "O serviço protegido de pagamentos está indisponível.";
    if (response.headers.get("content-type")?.includes("application/json")) {
      const error = await response.json() as { error?: string };
      if (error.error) message = error.error;
    }
    throw new Error(`${message} (${response.status})`);
  }
  const payload = await response.json() as { result: T };
  return payload.result;
}
