export function completeQuoteTotal(items: { giftId: string; shares: number }[], quotes: Map<string, { total_cents: number }> | undefined) {
  let total = 0;
  for (const item of items) {
    const value = quotes?.get(`${item.giftId}:${item.shares}`)?.total_cents;
    if (value === undefined || !Number.isFinite(value) || value < 0) return null;
    total += value;
  }
  return total;
}