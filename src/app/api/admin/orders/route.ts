import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/admin-guard";
import { listOrders } from "@/lib/server/admin-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const rows = await listOrders(sp.get("q") ?? "", sp.get("status") ?? "");
  return NextResponse.json({ orders: rows }, { headers: { "cache-control": "no-store" } });
}
