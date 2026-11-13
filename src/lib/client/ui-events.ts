"use client";
// Простая шина событий: кнопка корзины в шапке открывает лист корзины на любой странице.
import { useEffect, useState } from "react";

const EVT = "vors:open-cart";
export function openCart() {
  window.dispatchEvent(new CustomEvent(EVT));
}
export function useCartOpen(): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return [open, setOpen];
}
