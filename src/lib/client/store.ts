"use client";
// Корзина и черновик формы в localStorage: переживают перезагрузку в том же браузере.
import { useSyncExternalStore } from "react";
import type { CategoryId, VariantId } from "../catalog";
import { itemKey } from "../pricing";

export interface CartItem {
  uid: string;
  category: CategoryId;
  variant: VariantId | null;
  qty: number;
  heavy: boolean;
  secondSide: boolean;
  description: string;
}

export interface DraftPhoto {
  id: string;
  secret: string;
  preview: string; // маленькая data-URL миниатюра для показа после перезагрузки
}

export interface Draft {
  name: string;
  phone: string;
  address: string;
  outOfTown: boolean;
  wishDate: string;
  wishTime: string;
  comment: string;
  consent: boolean;
  photos: DraftPhoto[];
  idempotencyKey: string;
}

const CART_KEY = "vors.cart.v1";
const DRAFT_KEY = "vors.draft.v1";
const LAST_ORDER_KEY = "vors.lastOrder.v1";

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, "");

export const emptyDraft = (): Draft => ({
  name: "",
  phone: "",
  address: "",
  outOfTown: false,
  wishDate: "",
  wishTime: "",
  comment: "",
  consent: false,
  photos: [],
  idempotencyKey: uid() + uid(),
});

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* приватный режим или переполнение — работаем в памяти */
  }
}

type Listener = () => void;
function createStore<T>(key: string, init: () => T, sanitize: (v: T) => T) {
  let state: T | null = null;
  const listeners = new Set<Listener>();
  const get = () => {
    if (state === null) state = sanitize(read(key, init()));
    return state;
  };
  const set = (next: T | ((p: T) => T)) => {
    state = typeof next === "function" ? (next as (p: T) => T)(get()) : next;
    write(key, state);
    listeners.forEach((l) => l());
  };
  const subscribe = (l: Listener) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        state = null;
        l();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  };
  return { get, set, subscribe };
}

const VALID_CATS = new Set(["sofa", "armchair", "mattress", "chair", "other"]);
export const cartStore = createStore<CartItem[]>(CART_KEY, () => [], (v) =>
  Array.isArray(v)
    ? v
        .filter((i) => i && VALID_CATS.has(i.category) && Number.isFinite(i.qty))
        .map((i) => ({ ...i, qty: Math.min(20, Math.max(1, Math.round(i.qty))), description: i.description ?? "", secondSide: !!i.secondSide }))
    : [],
);
export const draftStore = createStore<Draft>(DRAFT_KEY, emptyDraft, (v) => ({ ...emptyDraft(), ...v, photos: Array.isArray(v?.photos) ? v.photos.slice(0, 3) : [] }));

const EMPTY: CartItem[] = [];
export function useCart() {
  return useSyncExternalStore(cartStore.subscribe, cartStore.get, () => EMPTY);
}
const EMPTY_DRAFT = emptyDraft();
export function useDraft() {
  return useSyncExternalStore(draftStore.subscribe, draftStore.get, () => EMPTY_DRAFT);
}
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const keyOf = (i: CartItem) => itemKey(i, i.uid);

/** Добавляет позицию; действительно одинаковые объединяются */
export function addToCart(item: Omit<CartItem, "uid">) {
  cartStore.set((items) => {
    const candidate = { ...item, uid: uid() };
    const k = keyOf(candidate);
    const same = items.find((i) => keyOf(i) === k);
    if (same) return items.map((i) => (i === same ? { ...i, qty: Math.min(20, i.qty + item.qty) } : i));
    return [...items, candidate];
  });
}

/** Меняет параметры позиции; если она стала идентична другой — объединяет */
export function updateCartItem(uidv: string, patch: Partial<Omit<CartItem, "uid" | "category">>) {
  cartStore.set((items) => {
    const idx = items.findIndex((i) => i.uid === uidv);
    if (idx < 0) return items;
    const updated = { ...items[idx], ...patch };
    const k = keyOf(updated);
    const twin = items.findIndex((i, j) => j !== idx && keyOf(i) === k);
    if (twin >= 0) {
      const merged = { ...items[twin], qty: Math.min(20, items[twin].qty + updated.qty) };
      return items.map((i, j) => (j === twin ? merged : i)).filter((_, j) => j !== idx);
    }
    return items.map((i, j) => (j === idx ? updated : i));
  });
}

export function removeCartItem(uidv: string): { item: CartItem; index: number } | null {
  const items = cartStore.get();
  const index = items.findIndex((i) => i.uid === uidv);
  if (index < 0) return null;
  const item = items[index];
  cartStore.set(items.filter((i) => i.uid !== uidv));
  return { item, index };
}

export function restoreCartItem(item: CartItem, index: number) {
  cartStore.set((items) => {
    if (items.some((i) => i.uid === item.uid)) return items;
    const next = [...items];
    next.splice(Math.min(index, next.length), 0, item);
    return next;
  });
}

export function clearAfterOrder(token: string, number: number) {
  cartStore.set([]);
  draftStore.set((d) => ({ ...emptyDraft(), name: d.name, phone: d.phone, address: d.address, outOfTown: d.outOfTown }));
  write(LAST_ORDER_KEY, { token, number, at: Date.now() });
}

export function lastOrder(): { token: string; number: number } | null {
  return read(LAST_ORDER_KEY, null);
}
