export async function validMercadoPagoSignature(secret: string, signature: string | null, requestId: string | null, paymentId: string) {
  if (!signature || !requestId || !/^[a-z0-9]+$/i.test(paymentId)) return false;
  const parts: Record<string, string> = {};
  for (const part of signature.split(",")) {
    const [name, value] = part.trim().split("=");
    if (name && value) parts[name] = value;
  }
  const ts = parts["ts"];
  const digest = parts["v1"];
  if (!ts || !/^\d+$/.test(ts) || !digest || !/^[a-f0-9]{64}$/i.test(digest)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = new Uint8Array((digest.match(/../g) ?? []).map((hex: string) => parseInt(hex, 16)));
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(`id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`));
}