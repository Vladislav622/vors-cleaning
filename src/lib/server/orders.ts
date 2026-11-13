import "server-only";
import { randomBytes } from "node:crypto";
import { quote, type ItemInput, type Quote } from "../pricing";
import type { OrderInput, OrderStatus } from "../order-schema";
import { normalizePhone } from "../order-schema";
import type { Pricing } from "../settings-schema";
import { q, tx } from "./db";
import { randomToken, sha256 } from "./security";

export interface OrderRow {
  id: string;
  number: number;
  public_token: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  address: string;
  out_of_town: boolean;
  wish_date: string | null;
  wish_time: string | null;
  comment: string | null;
  items: Quote["lines"];
  estimate: Omit<Quote, "lines">;
  pricing_snapshot: Pricing;
  final_price: number | null;
  agreed_visit_at: string | null;
  owner_note: string | null;
  created_at: string;
  updated_at: string;
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical((v as Record<string, unknown>)[k]))
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

export type CreateResult =
  | { ok: true; token: string; number: number; replay: boolean }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

/**
 * Создаёт заявку атомарно: пересчёт цены на сервере, снимок прайса, привязка фото.
 * Повтор с тем же idempotencyKey и тем же содержимым вернёт ту же заявку, а не дубль.
 */
export async function createOrder(input: OrderInput, pricing: Pricing): Promise<CreateResult> {
  const { idempotencyKey, ...rest } = input;
  const requestHash = sha256(canonical(rest));
  const qt = quote(input.items as ItemInput[], input.outOfTown, pricing);
  const { lines, ...estimate } = qt;

  return tx(async (c) => {
    const existing = await c.query<{ public_token: string; number: number; request_hash: string }>(
      "select public_token, number, request_hash from orders where idempotency_key = $1",
      [idempotencyKey],
    );
    if (existing.rows[0]) {
      const e = existing.rows[0];
      if (e.request_hash !== requestHash) return { ok: false, status: 409, error: "Эта заявка уже отправлена с другими данными. Обновите страницу." };
      return { ok: true, token: e.public_token, number: e.number, replay: true };
    }

    // Проверяем фото до вставки заявки
    const photoIds = input.photos.map((p) => p.id);
    if (photoIds.length) {
      const ph = await c.query<{ id: string; secret_hash: string; order_id: string | null }>(
        "select id, secret_hash, order_id from order_photos where id = any($1::uuid[]) for update",
        [photoIds],
      );
      const byId = new Map(ph.rows.map((r) => [r.id, r]));
      for (const p of input.photos) {
        const row = byId.get(p.id);
        if (!row || row.order_id || row.secret_hash !== sha256(p.secret))
          return { ok: false, status: 422, error: "Фото устарело — загрузите его заново.", fieldErrors: { photos: "Фото устарело — загрузите его заново." } };
      }
    }

    const token = randomToken(24);
    const ins = await c.query<{ id: string; number: number }>(
      `insert into orders (public_token, idempotency_key, request_hash, customer_name, phone, address, out_of_town,
         wish_date, wish_time, comment, consent_at, items, estimate, pricing_snapshot)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), $11,$12,$13)
       on conflict (idempotency_key) do nothing
       returning id, number`,
      [
        token,
        idempotencyKey,
        requestHash,
        input.name,
        normalizePhone(input.phone),
        input.address,
        input.outOfTown,
        input.wishDate || null,
        input.wishTime || null,
        input.comment || null,
        JSON.stringify(lines),
        JSON.stringify(estimate),
        JSON.stringify(pricing),
      ],
    );
    if (!ins.rows[0]) {
      // гонка двух одинаковых запросов: вторая транзакция увидит первую
      const again = await c.query<{ public_token: string; number: number }>("select public_token, number from orders where idempotency_key = $1", [idempotencyKey]);
      return { ok: true, token: again.rows[0].public_token, number: again.rows[0].number, replay: true };
    }
    const { id, number } = ins.rows[0];
    if (photoIds.length) await c.query("update order_photos set order_id = $1 where id = any($2::uuid[])", [id, photoIds]);
    await c.query("insert into order_events (order_id, kind, payload) values ($1, 'created', $2)", [id, JSON.stringify({ items: lines.length, photos: photoIds.length })]);
    return { ok: true, token, number, replay: false };
  });
}

/** Публичный вид заявки — без приватной заметки, без фото и без внутреннего id */
export async function getPublicOrder(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const r = await q<OrderRow & { photo_count: number; bonus_code: string | null; bonus_amount: number | null; bonus_expires: string | null; bonus_min: number | null }>(
    `select o.*, (select count(*)::int from order_photos p where p.order_id = o.id) as photo_count,
            b.code as bonus_code, b.amount as bonus_amount, b.expires_at as bonus_expires, b.min_order as bonus_min
       from orders o left join bonus_codes b on b.order_id = o.id
      where o.public_token = $1`,
    [token],
  );
  const o = r.rows[0];
  if (!o) return null;
  return {
    number: o.number,
    status: o.status,
    name: o.customer_name,
    address: o.address,
    outOfTown: o.out_of_town,
    wishDate: o.wish_date ? String(o.wish_date).slice(0, 10) : null,
    wishTime: o.wish_time,
    comment: o.comment,
    items: o.items,
    estimate: o.estimate,
    currency: o.pricing_snapshot.currency,
    finalPrice: o.final_price,
    agreedVisitAt: o.agreed_visit_at,
    photoCount: o.photo_count,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    bonus: o.bonus_code ? { code: o.bonus_code, amount: o.bonus_amount!, expiresAt: o.bonus_expires!, minOrder: o.bonus_min! } : null,
  };
}
export type PublicOrder = NonNullable<Awaited<ReturnType<typeof getPublicOrder>>>;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeBonusCode(): string {
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return `BN-${s.slice(0, 4)}-${s.slice(4)}`;
}
