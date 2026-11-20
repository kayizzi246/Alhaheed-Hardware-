import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const CartContext = createContext(null);

/** The customer's cart, held in memory until the order is submitted. */
export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  const add = useCallback((product, quantity = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock_available) }
            : i
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock_available) }];
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: Math.max(0, Math.min(quantity, i.product.stock_available)) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const remove = useCallback(
    (productId) => setItems((prev) => prev.filter((i) => i.product.id !== productId)),
    []
  );

  const clear = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  const value = useMemo(
    () => ({ items, add, setQuantity, remove, clear, subtotal, count }),
    [items, add, setQuantity, remove, clear, subtotal, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
