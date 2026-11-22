export function paymentIdempotencyKey(orderId: string) {
  return orderId;
}
export function reusablePix(order: { status: string; payment_method: string; pix_payload?: string | null; pix_qr_base64?: string | null }) {
  if (order.status !== "pending" || order.payment_method !== "pix" || !order.pix_payload) return null;
  return { qrCode: order.pix_payload, qrCodeBase64: order.pix_qr_base64 ?? "" };
}
export function paidAmountMatches(expectedCents: number, amount: number, currency: string) {
  return currency === "BRL" && Number.isFinite(amount) && Math.round(amount * 100) === expectedCents;
}