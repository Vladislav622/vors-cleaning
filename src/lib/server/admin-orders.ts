import "server-only";
import { STATUSES, type OrderStatus } from "../order-schema";
import { q } from "./db";
import type { OrderRow } from "./orders";

export async function listOrders(search: string, status: string) {
  const params: unknown[] = [];
  const where: string[] = [];
  if (STATUSES.includes(status as OrderStatus)) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }
  const s = search.trim().slice(0, 80);
  if (s) {
    const digits = s.replace(/\D/g, "");
    params.push(`%${s.toLowerCase()}%`);
    const p = params.length;
    const conds = [`lower(o.customer_name) like $${p}`, `lower(o.address) like $${p}`];
    if (digits) {
      params.push(`%${digits}%`);
      conds.push(`regexp_replace(o.phone, '\\D', '', 'g') like $${params.length}`);
      if (digits.length <= 7) {
        params.push(Number(digits));
        conds.push(`o.number = $${params.length}`);
      }
    }
    where.push(`(${conds.join(" or ")})`);
  }
  const r = await q<Pick<OrderRow, "id" | "number" | "status" | "customer_name" | "phone" | "address" | "created_at" | "final_price" | "agreed_visit_at" | "estimate" | "items" | "wish_date" | "wish_time" | "out_of_town"> & { photo_count: number; currency: string }>(
    `select o.id, o.number, o.status, o.customer_name, o.phone, o.address, o.created_at, o.final_price, o.agreed_visit_at,
            o.estimate, o.items, o.wish_date, o.wish_time, o.out_of_town, o.pricing_snapshot->>'currency' as currency,
            (select count(*)::int from order_photos p where p.order_id = o.id) as photo_count
       from orders o ${where.length ? "where " + where.join(" and ") : ""}
      order by o.created_at desc limit 200`,
    params,
  );
  return r.rows;
}

export async function getAdminOrder(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await q<OrderRow>("select * from orders where id = $1", [id]);
  const o = r.rows[0];
  if (!o) return null;
  const [photos, events, bonus] = await Promise.all([
    q<{ id: string; width: number; height: number; bytes: number }>("select id, width, height, bytes from order_photos where order_id = $1 order by created_at", [id]),
    q<{ id: number; kind: string; payload: Record<string, unknown>; created_at: string }>("select id, kind, payload, created_at from order_events where order_id = $1 order by created_at desc, id desc", [id]),
    q<{ id: string; code: string; amount: number; min_order: number; expires_at: string; redeemed_at: string | null }>("select id, code, amount, min_order, expires_at, redeemed_at from bonus_codes where order_id = $1", [id]),
  ]);
  return { ...o, wish_date: o.wish_date ? String(o.wish_date).slice(0, 10) : null, photos: photos.rows, events: events.rows, bonus: bonus.rows[0] ?? null };
}
export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

