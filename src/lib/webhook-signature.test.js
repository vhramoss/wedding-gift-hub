import { test, expect } from "bun:test";
import { validMercadoPagoSignature } from "./webhook-signature";
test("assinatura válida é aceita; alteração do pagamento e falta de assinatura são rejeitadas", async () => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode("test-only-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, enc.encode("id:123;request-id:request-test;ts:1700000000;"));
  const digest = Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, "0")).join("");
  const signature = `ts=1700000000,v1=${digest}`;
  expect(await validMercadoPagoSignature("test-only-secret", signature, "request-test", "123")).toBe(true);
  expect(await validMercadoPagoSignature("test-only-secret", signature, "request-test", "124")).toBe(false);
  expect(await validMercadoPagoSignature("test-only-secret", null, "request-test", "123")).toBe(false);
});