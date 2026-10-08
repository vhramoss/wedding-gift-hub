export function isGiftAvailable(gift: { shares_total: number | null; purchased_count: number; quantity: number }) {
  const total = Math.max(1, gift.shares_total ?? 1);
  return total > 1 ? gift.purchased_count < total : gift.quantity <= 0 || gift.purchased_count < gift.quantity;
}
export function parseDependentNames(text: string) {
  return [...new Set(text.split(/[,;|\n]+/).map((name) => name.trim()).filter(Boolean))].slice(0, 20);
}
