import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/server/db";
import { ImageError, MAX_UPLOAD_BYTES, normalizeImage } from "@/lib/server/images";
import { guard, jsonError, randomToken, sha256 } from "@/lib/server/security";

export const runtime = "nodejs";

/** Загрузка одного фото до отправки заявки. Возвращает id и секрет — только владелец секрета прикрепит фото к заявке. */
export async function POST(req: NextRequest) {
  const blocked = await guard(req, "upload", 30, 600);
  if (blocked) return blocked;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) return jsonError(413, "Файл больше 12 МБ.");
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return jsonError(400, "Не удалось прочитать файл.");
  }
  if (!file) return jsonError(400, "Файл не передан.");
  try {
    const img = await normalizeImage(Buffer.from(await file.arrayBuffer()));
    const secret = randomToken(24);
    const r = await q<{ id: string }>(
      "insert into order_photos (secret_hash, mime, width, height, bytes, data) values ($1,$2,$3,$4,$5,$6) returning id",
      [sha256(secret), img.mime, img.width, img.height, img.data.length, img.data],
    );
    // неприкреплённые фото старше суток удаляем
    if (Math.random() < 0.1) q("delete from order_photos where order_id is null and created_at < now() - interval '1 day'").catch(() => {});
    return NextResponse.json({ id: r.rows[0].id, secret, width: img.width, height: img.height, bytes: img.data.length }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ImageError) return jsonError(422, e.message);
    console.error("upload failed", e);
    return jsonError(500, "Не получилось сохранить фото. Попробуйте ещё раз.");
  }
}
