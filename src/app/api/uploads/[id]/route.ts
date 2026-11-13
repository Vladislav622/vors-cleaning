import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/server/db";
import { guard, jsonError, sha256 } from "@/lib/server/security";

export const runtime = "nodejs";

/** Удаление ещё не прикреплённого фото. Нужен секрет, выданный при загрузке. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = await guard(req, "upload-del", 60, 600);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const secret = req.headers.get("x-upload-secret") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id) || secret.length < 16) return jsonError(400, "Неверный запрос.");
  await q("delete from order_photos where id = $1 and secret_hash = $2 and order_id is null", [id, sha256(secret)]);
  return NextResponse.json({ ok: true });
}
