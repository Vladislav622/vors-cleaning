import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/admin-guard";
import { q } from "@/lib/server/db";
import { jsonError } from "@/lib/server/security";

export const runtime = "nodejs";

/** Ручное погашение бонуса владельцем (автоматического погашения в MVP нет) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const r = await q<{ order_id: string }>("update bonus_codes set redeemed_at = now() where id = $1 and redeemed_at is null returning order_id", [id]);
  if (!r.rows[0]) return jsonError(404, "Код не найден или уже использован.");
  await q("insert into order_events (order_id, kind, payload) values ($1, 'bonus_redeemed', '{}')", [r.rows[0].order_id]);
  return NextResponse.json({ ok: true });
}
