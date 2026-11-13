import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/server/db";
import { makeBonusCode } from "@/lib/server/orders";
import { guard, jsonError } from "@/lib/server/security";
import { loadSettings } from "@/lib/server/settings";

export const runtime = "nodejs";

/**
 * Выдача бонуса после мини-игры. Один код на заявку (уникальный индекс).
 * Это не античит: факт прохождения игры сообщает браузер, поэтому владелец применяет бонус вручную.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const blocked = await guard(req, "game", 12, 600);
  if (blocked) return blocked;
  const { token } = await ctx.params;
  const s = await loadSettings();
  if (s.game.mode !== "bonus") return NextResponse.json({ bonus: null, mode: s.game.mode });
  const o = await q<{ id: string; status: string }>("select id, status from orders where public_token = $1", [token]);
  const order = o.rows[0];
  if (!order) return jsonError(404, "Заявка не найдена.");
  if (order.status === "cancelled") return jsonError(409, "Заявка отменена.");
  const expires = new Date(Date.now() + s.game.validDays * 864e5);
  let created = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ins = await q(
        `insert into bonus_codes (order_id, code, amount, min_order, expires_at) values ($1,$2,$3,$4,$5)
         on conflict (order_id) do nothing`,
        [order.id, makeBonusCode(), s.game.bonusAmount, s.game.minNextOrder, expires],
      );
      created = ins.rowCount === 1;
      break;
    } catch (e) {
      if ((e as { code?: string }).code !== "23505" || attempt === 2) throw e; // повтор при совпадении кода
    }
  }
  const b = await q<{ code: string; amount: number; min_order: number; expires_at: string }>(
    "select code, amount, min_order, expires_at from bonus_codes where order_id = $1",
    [order.id],
  );
  const r = b.rows[0];
  if (created) await q("insert into order_events (order_id, kind, payload) values ($1, 'bonus', $2)", [order.id, JSON.stringify({ code: r.code })]);
  return NextResponse.json({ bonus: { code: r.code, amount: r.amount, minOrder: r.min_order, expiresAt: r.expires_at } }, { headers: { "cache-control": "no-store" } });
}
