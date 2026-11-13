import { NextResponse } from "next/server";
import { getPublicOrder } from "@/lib/server/orders";
import { jsonError } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const o = await getPublicOrder(token);
  if (!o) return jsonError(404, "Заявка не найдена.");
  return NextResponse.json(o, { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
