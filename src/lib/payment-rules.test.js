import { test, expect } from "bun:test";
import { paymentIdempotencyKey, reusablePix, paidAmountMatches } from "./payment-rules";
test("repeated attempts use the order id as the idempotency key", () => {
  const id = "997715d6-5555-4444-8888-6615c63f9123";
  expect(paymentIdempotencyKey(id)).toBe(id);
  expect(paymentIdempotencyKey(id)).toBe(paymentIdempotencyKey(id));
  expect(paymentIdempotencyKey("another-order")).not.toBe(paymentIdempotencyKey(id));
});
test("pending Pix reuses its QR", () => {
  expect(reusablePix({ status: "pending", payment_method: "pix", pix_payload: "existing-pix", pix_qr_base64: "image" })).toEqual({ qrCode: "existing-pix", qrCodeBase64: "image" });
  expect(reusablePix({ status: "paid", payment_method: "pix", pix_payload: "existing-pix" })).toBeNull();
  expect(reusablePix({ status: "pending", payment_method: "credit", pix_payload: "existing-pix" })).toBeNull();
});
test("confirmation requires exact total in BRL", () => {
  expect(paidAmountMatches(30000, 300, "BRL")).toBe(true);
  expect(paidAmountMatches(30000, 250, "BRL")).toBe(false);
  expect(paidAmountMatches(30000, 300, "USD")).toBe(false);
});