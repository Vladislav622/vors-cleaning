// Расчёт предварительной стоимости. Один и тот же код работает в браузере (подсказка) и на сервере (источник истины).
//
// Порядок: базовая цена варианта
//   × (1 + % второй стороны матраса)      — если выбрана вторая сторона
//   × (1 + % сильных загрязнений)          — если отмечено
//   → округление ВВЕРХ до шага (roundingStep) за единицу
//   × количество
// Сумма известных позиций → минимальный заказ (только к чистке) → + выезд за город (фиксированно, отдельно).
import { CATEGORY_BY_ID, type CategoryId, type VariantId } from "./catalog";
import type { Pricing } from "./settings-schema";

export interface ItemInput {
  category: CategoryId;
  variant?: VariantId | null;
  qty: number;
  heavy: boolean;
  secondSide?: boolean;
  description?: string;
}

export interface QuoteLine {
  key: string;
  category: CategoryId;
  variant: VariantId | null;
  qty: number;
  heavy: boolean;
  secondSide: boolean;
  description: string;
  manual: boolean;
  basePrice: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface Quote {
  lines: QuoteLine[];
  knownSubtotal: number;
  manualCount: number;
  minOrder: number;
  minTopUp: number;
  cleaningFrom: number;
  travelFee: number;
  totalFrom: number;
  /** true — все позиции посчитаны, сумма точная (предварительная) */
  exact: boolean;
  /** true — нет ни одной позиции с известной ценой */
  manualOnly: boolean;
  currency: string;
}

export function roundUp(value: number, step: number): number {
  const s = Math.max(1, Math.round(step));
  // защищаемся от ошибок плавающей точки (12000*1.3 = 15600.000000000002)
  return Math.ceil(Math.round(value * 1000) / 1000 / s) * s;
}

export function itemKey(i: Pick<ItemInput, "category" | "variant" | "heavy" | "secondSide">, uid?: string): string {
  if (i.category === "other") return `other:${uid ?? "x"}`;
  const side = CATEGORY_BY_ID[i.category].hasSecondSide && i.secondSide ? "2s" : "1s";
  return `${i.category}:${i.variant}:${i.heavy ? "heavy" : "normal"}:${side}`;
}

export function unitPrice(i: ItemInput, p: Pricing): number | null {
  if (i.category === "other" || !i.variant) return null;
  const base = p.variants[i.variant];
  if (base == null) return null;
  let v = base;
  if (CATEGORY_BY_ID[i.category].hasSecondSide && i.secondSide) v *= 1 + p.secondSidePct / 100;
  if (i.heavy) v *= 1 + p.heavySoilingPct / 100;
  return roundUp(v, p.roundingStep);
}

export function quote(items: ItemInput[], outOfTown: boolean, p: Pricing): Quote {
  const lines: QuoteLine[] = items.map((i, idx) => {
    const manual = i.category === "other";
    const u = unitPrice(i, p);
    const secondSide = Boolean(CATEGORY_BY_ID[i.category].hasSecondSide && i.secondSide);
    return {
      key: itemKey(i, String(idx)),
      category: i.category,
      variant: manual ? null : (i.variant ?? null),
      qty: i.qty,
      heavy: i.heavy,
      secondSide,
      description: manual ? (i.description ?? "").trim() : "",
      manual,
      basePrice: manual || !i.variant ? null : p.variants[i.variant],
      unitPrice: u,
      lineTotal: u == null ? null : u * i.qty,
    };
  });
  const knownSubtotal = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const manualCount = lines.filter((l) => l.manual).length;
  const hasKnown = lines.some((l) => !l.manual);
  const minTopUp = hasKnown && knownSubtotal < p.minOrder ? p.minOrder - knownSubtotal : 0;
  const cleaningFrom = hasKnown ? knownSubtotal + minTopUp : 0;
  const travelFee = outOfTown ? p.outOfTownFee : 0;
  return {
    lines,
    knownSubtotal,
    manualCount,
    minOrder: p.minOrder,
    minTopUp,
    cleaningFrom,
    travelFee,
    totalFrom: cleaningFrom + travelFee,
    exact: manualCount === 0 && hasKnown,
    manualOnly: !hasKnown && manualCount > 0,
    currency: p.currency,
  };
}

export function formatMoney(v: number, currency: string): string {
  return `${new Intl.NumberFormat("ru-RU").format(v)} ${currency}`;
}

export function describeItem(l: Pick<QuoteLine, "category" | "variant" | "heavy" | "secondSide">): string {
  const parts: string[] = [];
  if (l.secondSide) parts.push("2 стороны");
  if (l.heavy) parts.push("сильные загрязнения");
  return parts.length ? parts.join(", ").replace(/^./, (c) => c.toUpperCase()) : "Обычная чистка";
}
