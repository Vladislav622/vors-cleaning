import { NextResponse, type NextRequest } from "next/server";
import { checkAdminPassword, createSession, setAdminPassword } from "@/lib/server/auth";
import { requireAdmin } from "@/lib/server/admin-guard";
import { jsonError, rateLimit, clientIp } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!(await rateLimit(`pw:${clientIp(req)}`, 6, 900))) return jsonError(429, "Слишком много попыток.");
  const b = (await req.json().catch(() => null)) as { current?: string; next?: string } | null;
  const current = String(b?.current ?? ""), next = String(b?.next ?? "");
  if (!(await checkAdminPassword(current))) return jsonError(400, "Текущий пароль неверный.", { fieldErrors: { current: "Текущий пароль неверный" } });
  if (next.length < 10 || next.length > 200) return jsonError(422, "Новый пароль — от 10 символов.", { fieldErrors: { next: "От 10 символов" } });
  await setAdminPassword(next); // удаляет все сеансы
  await createSession(req.headers.get("user-agent")); // текущий браузер остаётся в кабинете
  return NextResponse.json({ ok: true });
}
