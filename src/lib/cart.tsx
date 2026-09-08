import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  giftId: string;
  name: string;
  imageUrl: string | null;
  /** Valor unitário (presente inteiro ou uma cota). */
  unitCents: number;
  /** Quantidade de cotas (1 quando o presente não é dividido). */
  shares: number;
  /** Máximo de cotas disponíveis. */
  maxShares: number;
  isShared: boolean;
};

type CartState = {
  items: CartItem[];
  count: number;
  totalCents: number;
  add: (item: CartItem) => void;
  setShares: (giftId: string, shares: number) => void;
  remove: (giftId: string) => void;
  clear: () => void;
  has: (giftId: string) => boolean;
};

const CartContext = createContext<CartState | null>(null);

function storageKey(slug: string) {
  return `cc-cart:${slug}`;
}

export function CartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(slug));
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
  }, [slug]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(slug), JSON.stringify(items));
    } catch {
      /* ignora */
    }
  }, [items, slug]);

  const add = useCallback((item: CartItem) => {
    setItems((current) => {
      const existing = current.find((i) => i.giftId === item.giftId);
      if (!existing) return [...current, item];
      return current.map((i) =>
        i.giftId === item.giftId
          ? { ...i, shares: Math.min(i.maxShares, i.shares + item.shares) }
          : i,
      );
    });
  }, []);

  const setShares = useCallback((giftId: string, shares: number) => {
    setItems((current) =>
      current.map((i) =>
        i.giftId === giftId ? { ...i, shares: Math.max(1, Math.min(i.maxShares, shares)) } : i,
      ),
    );
  }, []);

  const remove = useCallback(
    (giftId: string) => setItems((current) => current.filter((i) => i.giftId !== giftId)),
    [],
  );

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartState>(() => {
    const totalCents = items.reduce((sum, i) => sum + i.unitCents * i.shares, 0);
    return {
      items,
      count: items.length,
      totalCents,
      add,
      setShares,
      remove,
      clear,
      has: (giftId: string) => items.some((i) => i.giftId === giftId),
    };
  }, [items, add, setShares, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart precisa estar dentro de CartProvider");
  }
  return ctx;
}
