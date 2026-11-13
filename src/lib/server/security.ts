import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { q } from "./db";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function clientIp(req: Request): string {
  const h = req.headers;
  const xf = h.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return h.get("x-real-ip") ?? "local";
}

/**
 * Проверка источника для изменяющих запросов: Origin должен совпадать с хостом
 * (или с APP_URL). Браузерные кросс-сайтовые POST будут отклонены.
 */
export function checkOrigin(req: NextRequest | Request): boolean {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  if (!origin) return site === "same-origin";
  const allowed = new Set<string>();
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    allowed.add(`${proto}://${host}`);
  }
  return allowed.has(origin);
}

/** Фиксированное окно в PostgreSQL: работает и в serverless, где память процесса не общая */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000);
  const r = await q<{ count: number }>(
    `insert into rate_limits (key, window_start, count) values ($1, $2, 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [key, windowStart],
  );
  if (Math.random() < 0.02) {
    q("delete from rate_limits where window_start < now() - interval '1 day'").catch(() => {});
  }
  return r.rows[0].count <= limit;
}

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "cache-control": "no-store" } });
}

export async function guard(req: NextRequest, bucket: string, limit: number, windowSec: number) {
  if (!checkOrigin(req)) return jsonError(403, "Запрос отклонён: неверный источник.");
  const ok = await rateLimit(`${bucket}:${clientIp(req)}`, limit, windowSec);
  if (!ok) return jsonError(429, "Слишком много запросов. Подождите немного и попробуйте снова.");
  return null;
}
