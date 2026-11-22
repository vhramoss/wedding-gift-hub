import { test, expect } from "bun:test";
import { completeQuoteTotal } from "./gift-quote-rules";
test("preço só existe quando todos os presentes têm cotação final", () => {
  const items = [{ giftId: "a", shares: 1 }, { giftId: "b", shares: 2 }];
  expect(completeQuoteTotal(items, undefined)).toBeNull();
  expect(completeQuoteTotal(items, new Map([["a:1", { total_cents: 12000 }]]))).toBeNull();
  expect(completeQuoteTotal(items, new Map([["a:1", { total_cents: 12000 }], ["b:2", { total_cents: 22000 }]]))).toBe(34000);
});