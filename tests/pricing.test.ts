import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, unitPrice, roundUp } from "../src/lib/pricing.ts";
import { DEFAULT_SETTINGS } from "../src/lib/settings-schema.ts";

const p = { ...DEFAULT_SETTINGS.pricing, roundingStep: 100 };

test("roundUp устойчив к плавающей точке", () => {
  assert.equal(roundUp(15600.000000000002, 100), 15600);
  assert.equal(roundUp(15601, 100), 15700);
  assert.equal(roundUp(0, 100), 0);
});

test("порядок процентов: вторая сторона, затем загрязнения, округление за единицу", () => {
  // 7000 × 1.7 = 11900 × 1.3 = 15470 → 15500
  assert.equal(unitPrice({ category: "mattress", variant: "mattress-single", qty: 1, heavy: true, secondSide: true }, p), 15500);
  // вторая сторона игнорируется у дивана
  assert.equal(unitPrice({ category: "sofa", variant: "sofa-2", qty: 1, heavy: false, secondSide: true }, p), 12000);
});

test("минимальный заказ применяется к чистке, выезд добавляется отдельно", () => {
  const q = quote([{ category: "chair", variant: "chair-seat", qty: 2, heavy: false }], true, p);
  assert.equal(q.knownSubtotal, 3000);
  assert.equal(q.minTopUp, 5000);
  assert.equal(q.cleaningFrom, 8000);
  assert.equal(q.travelFee, 3000);
  assert.equal(q.totalFrom, 11000);
  assert.equal(q.exact, true);
});

test("смешанный заказ: известная сумма отдельно, «Другое» не бесплатно", () => {
  const q = quote(
    [
      { category: "sofa", variant: "sofa-3", qty: 1, heavy: true },
      { category: "other", qty: 1, heavy: false, description: "Пуф" },
    ],
    false,
    p,
  );
  assert.equal(q.lines[1].unitPrice, null);
  assert.equal(q.lines[1].lineTotal, null);
  assert.equal(q.knownSubtotal, 19500);
  assert.equal(q.manualCount, 1);
  assert.equal(q.exact, false);
  assert.equal(q.totalFrom, 19500);
});

test("только «Другое»: минимум не навязывается, цена по фото", () => {
  const q = quote([{ category: "other", qty: 1, heavy: false, description: "Банкетка" }], true, p);
  assert.equal(q.manualOnly, true);
  assert.equal(q.cleaningFrom, 0);
  assert.equal(q.minTopUp, 0);
  assert.equal(q.travelFee, 3000);
});

test("количество умножает округлённую единицу", () => {
  const q = quote([{ category: "armchair", variant: "armchair-standard", qty: 3, heavy: true }], false, p);
  // 6000 × 1.3 = 7800 × 3
  assert.equal(q.lines[0].lineTotal, 23400);
});
