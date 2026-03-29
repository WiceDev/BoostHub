// Gift cart stored in localStorage — persists across page navigations

export interface GiftCartItem {
  giftId: number;
  recipientName: string;
  phoneCountry: string;
  phoneNumber: string;
  apartment: string;
  street: string;
  city: string;
  stateRegion: string;
  zip: string;
  country: string;
  senderName: string;
  addedAt: string;
}

const CART_KEY = "gift_cart";

export function getGiftCart(): GiftCartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToGiftCart(item: GiftCartItem): void {
  const cart = getGiftCart().filter((c) => c.giftId !== item.giftId);
  cart.push(item);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function removeFromGiftCart(giftId: number): void {
  const cart = getGiftCart().filter((c) => c.giftId !== giftId);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function clearGiftCart(): void {
  localStorage.removeItem(CART_KEY);
}

export function getGiftCartItem(giftId: number): GiftCartItem | undefined {
  return getGiftCart().find((c) => c.giftId === giftId);
}

// Mock gift order history stored in localStorage
export interface GiftOrder {
  id: string;
  giftId: number;
  giftName: string;
  giftEmoji: string;
  giftColor: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  senderName: string;
  amount: number;
  status: "pending" | "processing" | "in_transit" | "completed" | "failed";
  failureReason?: string;
  refunded?: boolean;
  createdAt: string;
}

const ORDERS_KEY = "gift_orders";

export function getGiftOrders(): GiftOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addGiftOrder(order: GiftOrder): void {
  const orders = getGiftOrders();
  orders.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}
