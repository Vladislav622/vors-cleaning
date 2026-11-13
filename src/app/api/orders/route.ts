import { NextResponse, type NextRequest } from "next/server";
import { fieldErrors, orderInputSchema } from "@/lib/order-schema";
import { createOrder } from "@/lib/server/orders";
import { guard, jsonError } from "@/lib/server/security";
import { loadSettings } from "@/lib/server/settings";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const blocked = await guard(req, "order", 8, 600);
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Неверный формат запроса.");
  }
  // Готовым суммам из браузера не доверяем: принимаем только состав, считаем сами
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) return jsonError(422, "Проверьте поля формы.", { fieldErrors: fieldErrors(parsed.error) });
  try {
    const settings = await loadSettings();
    const r = await createOrder(parsed.data, settings.pricing);
    if (!r.ok) return jsonError(r.status, r.error, r.fieldErrors ? { fieldErrors: r.fieldErrors } : {});
    return NextResponse.json({ token: r.token, number: r.number, replay: r.replay }, { status: r.replay ? 200 : 201, headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("order failed", e);
    return jsonError(500, "Заявка не сохранилась. Данные на месте — попробуйте отправить ещё раз.");
  }
}
