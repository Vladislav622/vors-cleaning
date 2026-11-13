import { NextResponse, type NextRequest } from "next/server";
import { checkAdminPassword, createSession } from "@/lib/server/auth";
import { guard, jsonError } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const blocked = await guard(req, "login", 8, 900);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const pw = typeof body?.password === "string" ? body.password : "";
  if (!pw || pw.length > 200) return jsonError(400, "Введите пароль.");
  if (!(await checkAdminPassword(pw))) {
    await new Promise((r) => setTimeout(r, 400));
    return jsonError(401, "Неверный пароль.");
  }
  await createSession(req.headers.get("user-agent"));
  return NextResponse.json({ ok: true });
}
