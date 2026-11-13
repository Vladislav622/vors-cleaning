"use client";
export class ApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}
export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let r: Response;
  try {
    r = await fetch(url, { ...rest, headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers }, body: json !== undefined ? JSON.stringify(json) : rest.body, cache: "no-store" });
  } catch {
    throw new ApiError("Нет связи с сервером. Изменения не сохранены — повторите.", 0);
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) {
    location.href = "/admin/login";
    throw new ApiError("Сессия истекла.", 401);
  }
  if (!r.ok) throw new ApiError(j.error || "Ошибка запроса.", r.status, j.fieldErrors);
  return j as T;
}
