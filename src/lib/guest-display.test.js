import { test, expect } from 'bun:test';
import { isGiftAvailable, parseDependentNames } from './guest-display';
test('esgotados não aparecem, cotas disponíveis continuam', () => {
  expect(isGiftAvailable({ shares_total: 1, quantity: 1, purchased_count: 1 })).toBe(false);
  expect(isGiftAvailable({ shares_total: 3, quantity: 1, purchased_count: 3 })).toBe(false);
  expect(isGiftAvailable({ shares_total: 3, quantity: 1, purchased_count: 2 })).toBe(true);
});
test('permite cadastrar vários dependentes por linhas ou separadores', () => {
  expect(parseDependentNames('Ana\nPedro\nLia')).toEqual(['Ana', 'Pedro', 'Lia']);
  expect(parseDependentNames('Ana, Pedro; Lia | Ana')).toEqual(['Ana', 'Pedro', 'Lia']);
});
