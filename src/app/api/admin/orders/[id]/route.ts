import { NextResponse, type NextRequest } from "next/server";
import { adminOrderPatchSchema, fieldErrors } from "@/lib/order-schema";
import { requireAdmin } from "@/lib/server/admin-guard";
import { getAdminOrder } from "@/lib/server/admin-orders";
import { tx } from "@/lib/server/db";
import { jsonError } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const o = await getAdminOrder((await ctx.params).id);
  if (!o) return jsonError(404, "Заявка не найдена.");
  return NextResponse.json(o, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = adminOrderPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "Проверьте поля.", { fieldErrors: fieldErrors(parsed.error) });
  const p = parsed.data;
  const result = await tx(async (c) => {
    const cur = await c.query<{ status: string; final_price: number | null; agreed_visit_at: Date | null; owner_note: string | null }>(
      "select status, final_price, agreed_visit_at, owner_note from orders where id = $1 for update",
      [id],
    );
    const o = cur.rows[0];
    if (!o) return { status: 404, error: "Заявка не найдена." };
    const next = {
      status: p.status ?? o.status,
      final_price: p.finalPrice !== undefined ? p.finalPrice : o.final_price,
      agreed_visit_at: p.agreedVisitAt !== undefined ? (p.agreedVisitAt ? new Date(p.agreedVisitAt) : null) : o.agreed_visit_at,
      owner_note: p.ownerNote !== undefined ? (p.ownerNote?.trim() || null) : o.owner_note,
    };
    if ((next.status === "agreed" || next.status === "done") && (next.final_price == null || next.agreed_visit_at == null)) {
      return {
        status: 422,
        error: "Для статуса «Согласована» нужны итоговая цена и время выезда.",
        fieldErrors: {
          ...(next.final_price == null ? { finalPrice: "Укажите итоговую цену" } : {}),
          ...(next.agreed_visit_at == null ? { agreedVisitAt: "Укажите время выезда" } : {}),
        },
      };
    }
    await c.query("update orders set status=$2, final_price=$3, agreed_visit_at=$4, owner_note=$5, updated_at=now() where id=$1", [
      id,
      next.status,
      next.final_price,
      next.agreed_visit_at,
      next.owner_note,
    ]);
    const ev: [string, object][] = [];
    if (next.status !== o.status) ev.push(["status", { from: o.status, to: next.status }]);
    if (next.final_price !== o.final_price) ev.push(["price", { from: o.final_price, to: next.final_price }]);
    if ((next.agreed_visit_at?.getTime() ?? null) !== (o.agreed_visit_at?.getTime() ?? null)) ev.push(["visit", { to: next.agreed_visit_at }]);
    if (next.owner_note !== o.owner_note) ev.push(["note", {}]);
    for (const [kind, payload] of ev) await c.query("insert into order_events (order_id, kind, payload) values ($1,$2,$3)", [id, kind, JSON.stringify(payload)]);
    return { status: 200 };
  });
  if (result.status !== 200) return jsonError(result.status, result.error!, result.fieldErrors ? { fieldErrors: result.fieldErrors } : {});
  return NextResponse.json(await getAdminOrder(id), { headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const confirm = req.nextUrl.searchParams.get("confirm");
  const r = await tx(async (c) => {
    const o = await c.query<{ number: number }>("select number from orders where id = $1 for update", [id]);
    if (!o.rows[0]) return 404;
    if (confirm !== String(o.rows[0].number)) return 422;
    await c.query("delete from orders where id = $1", [id]); // фото, история и бонус удаляются каскадом
    return 200;
  });
  if (r === 404) return jsonError(404, "Заявка не найдена.");
  if (r === 422) return jsonError(422, "Подтвердите удаление номером заявки.");
  return NextResponse.json({ ok: true });
}
