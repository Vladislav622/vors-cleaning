import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/server/auth";
import { checkOrigin, jsonError } from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return jsonError(403, "Запрос отклонён.");
  await destroySession();
  return NextResponse.json({ ok: true });
}
