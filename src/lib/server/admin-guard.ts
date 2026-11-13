import "server-only";
import type { NextRequest } from "next/server";
import { isAdmin } from "./auth";
import { checkOrigin, jsonError } from "./security";

/** Для всех admin API: сессия + (для изменяющих методов) проверка источника */
export async function requireAdmin(req: NextRequest) {
  if (req.method !== "GET" && req.method !== "HEAD" && !checkOrigin(req)) return jsonError(403, "Запрос отклонён: неверный источник.");
  if (!(await isAdmin())) return jsonError(401, "Нужно войти в кабинет.");
  return null;
}
