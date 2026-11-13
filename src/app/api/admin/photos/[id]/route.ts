import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/admin-guard";
import { q } from "@/lib/server/db";
import { jsonError } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Фото доступны только из кабинета, по сессии владельца. Публичного адреса у фото нет. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError(400, "Неверный запрос.");
  const r = await q<{ data: Buffer; mime: string }>("select data, mime from order_photos where id = $1 and order_id is not null", [id]);
  const p = r.rows[0];
  if (!p) return jsonError(404, "Фото не найдено.");
  return new Response(new Uint8Array(p.data), {
    headers: {
      "content-type": p.mime,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}
