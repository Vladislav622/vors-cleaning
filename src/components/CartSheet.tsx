"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_BY_ID, itemTitle, type VariantId } from "@/lib/catalog";
import { formatMoney, quote } from "@/lib/pricing";
import type { Pricing } from "@/lib/settings-schema";
import { removeCartItem, restoreCartItem, updateCartItem, useCart, type CartItem } from "@/lib/client/store";
import { useCartOpen } from "@/lib/client/ui-events";
import { Stepper } from "./ui";

export function Totals({ items, pricing, outOfTown }: { items: CartItem[]; pricing: Pricing; outOfTown: boolean }) {
  const q = useMemo(() => quote(items, outOfTown, pricing), [items, outOfTown, pricing]);
  const m = (v: number) => formatMoney(v, pricing.currency);
  return (
    <div className="totals num" aria-live="polite">
      {q.manualOnly ? (
        <div className="row">
          <span>Чистка</span>
          <span>по фото</span>
        </div>
      ) : (
        <>
          <div className="row">
            <span>Известные позиции</span>
            <span>{m(q.knownSubtotal)}</span>
          </div>
          {q.minTopUp > 0 && (
            <div className="row muted">
              <span>Доплата до минимального заказа</span>
              <span>{m(q.minTopUp)}</span>
            </div>
          )}
        </>
      )}
      {q.manualCount > 0 && (
        <div className="row">
          <span>Позиции по фото: {q.manualCount}</span>
          <span className="manual-tag">цену назовёт мастер</span>
        </div>
      )}
      {q.travelFee > 0 && (
        <div className="row">
          <span>Выезд за город</span>
          <span>{m(q.travelFee)}</span>
        </div>
      )}
      <div className="row total">
        <span>{q.exact ? "Итого" : "Итого от"}</span>
        <span>{q.manualOnly ? (q.travelFee ? `${m(q.travelFee)} + по фото` : "по фото") : q.exact ? m(q.totalFrom) : `${m(q.totalFrom)} + по фото`}</span>
      </div>
    </div>
  );
}

export function CartLine({ item, pricing, onRemove }: { item: CartItem; pricing: Pricing; onRemove: (i: CartItem) => void }) {
  const c = CATEGORY_BY_ID[item.category];
  const q = quote([item], false, pricing).lines[0];
  return (
    <div className="cart-item">
      <div className="cart-item-top">
        <div>
          <h3>{itemTitle(item.category, item.variant)}</h3>
          {item.category === "other" ? (
            <div className="sub">{item.description}</div>
          ) : (
            <div className="sub num">
              {formatMoney(q.unitPrice!, pricing.currency)} × {item.qty}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          {q.lineTotal == null ? <span className="manual-tag">по фото</span> : <strong className="num">{formatMoney(q.lineTotal, pricing.currency)}</strong>}
        </div>
      </div>
      <div className="cart-item-ctrls">
        <Stepper size="sm" value={item.qty} min={1} max={20} label={`Количество: ${c.label}`} onChange={(v) => updateCartItem(item.uid, { qty: v })} />
        {c.variants.length > 0 && (
          <select
            className="mini-select"
            aria-label="Вариант"
            value={item.variant ?? ""}
            onChange={(e) => updateCartItem(item.uid, { variant: e.target.value as VariantId })}
          >
            {c.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        {c.hasSecondSide && (
          <button type="button" className="mini-toggle" aria-pressed={item.secondSide} onClick={() => updateCartItem(item.uid, { secondSide: !item.secondSide })}>
            2 стороны
          </button>
        )}
        <button type="button" className="mini-toggle" aria-pressed={item.heavy} onClick={() => updateCartItem(item.uid, { heavy: !item.heavy })}>
          Сильные загрязнения
        </button>
        <button type="button" className="link-btn" style={{ marginLeft: "auto", color: "var(--danger)" }} onClick={() => onRemove(item)}>
          Удалить
        </button>
      </div>
    </div>
  );
}

/** Хук удаления с отменой: позиция возвращается на прежнее место */
export function useUndoRemove() {
  const [undo, setUndo] = useState<{ item: CartItem; index: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const remove = (i: CartItem) => {
    const r = removeCartItem(i.uid);
    if (!r) return;
    setUndo(r);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 6000);
  };
  const restore = () => {
    if (undo) restoreCartItem(undo.item, undo.index);
    setUndo(null);
  };
  return { undo, remove, restore };
}

export function UndoToast({ undo, restore }: { undo: { item: CartItem } | null; restore: () => void }) {
  return (
    <AnimatePresence>
      {undo && (
        <motion.div className="toast" style={{ zIndex: 70 }} role="status" initial={{ opacity: 0, y: 12, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 12, x: "-50%" }}>
          <span>Удалено: {CATEGORY_BY_ID[undo.item.category].label.toLowerCase()}</span>
          <button type="button" onClick={restore}>
            Вернуть
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EmptyCart({ onPick }: { onPick: () => void }) {
  return (
    <div className="empty">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M10 38v-8a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v8" />
        <path d="M6 38h52v8a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-8Z" />
        <circle cx="26" cy="31" r="1.6" fill="currentColor" />
        <circle cx="38" cy="31" r="1.6" fill="currentColor" />
        <path d="M14 50v5M50 50v5" strokeLinecap="round" />
      </svg>
      <strong>Пока ничего не выбрано</strong>
      <span className="muted">Добавьте диван, кресло, матрас или стул — сумма посчитается сама.</span>
      <button className="btn btn-primary" type="button" onClick={onPick}>
        Выбрать мебель
      </button>
    </div>
  );
}

export default function CartSheet({ pricing }: { pricing: Pricing }) {
  const [open, setOpen] = useCartOpen();
  const items = useCart();
  const reduced = useReducedMotion();
  const router = useRouter();
  const path = usePathname();
  const { undo, remove, restore } = useUndoRemove();
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, setOpen]);
  useEffect(() => setOpen(false), [path, setOpen]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cart-title"
              initial={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
            >
              <div className="grabber" aria-hidden />
              <div className="sheet-head">
                <h2 id="cart-title">Заявка</h2>
                <button ref={closeBtn} className="icon-btn" type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>
                  ✕
                </button>
              </div>
              <div className="sheet-body">
                {items.length === 0 ? (
                  <EmptyCart
                    onPick={() => {
                      setOpen(false);
                      if (path !== "/") router.push("/");
                    }}
                  />
                ) : (
                  items.map((i) => <CartLine key={i.uid} item={i} pricing={pricing} onRemove={remove} />)
                )}
              </div>
              {items.length > 0 && (
                <div className="sheet-foot">
                  <Totals items={items} pricing={pricing} outOfTown={false} />
                  <div className="muted" style={{ fontSize: 13 }}>
                    Выезд за город отмечается в форме. Итоговую цену мастер согласует после разговора.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        if (path !== "/") router.push("/");
                      }}
                    >
                      Добавить ещё
                    </button>
                    <Link className="btn btn-primary" style={{ flex: 1 }} href="/checkout" onClick={() => setOpen(false)}>
                      Оформить заявку
                    </Link>
                  </div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <UndoToast undo={undo} restore={restore} />
    </>
  );
}
