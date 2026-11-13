import "server-only";
import { scrypt as _scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { q } from "./db";
import { randomToken, sha256 } from "./security";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
export const SESSION_COOKIE = "vors_admin";
const SESSION_DAYS = 14;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64, PARAMS);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const key = await scrypt(pw, Buffer.from(s, "base64"), 64, PARAMS);
  const expected = Buffer.from(k, "base64");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Пароль из БД; если его ещё нет — однократно берём ADMIN_PASSWORD из окружения */
export async function checkAdminPassword(pw: string): Promise<boolean> {
  const r = await q<{ password_hash: string }>("select password_hash from admin_credentials where id = 1");
  if (r.rows[0]) return verifyPassword(pw, r.rows[0].password_hash);
  const initial = process.env.ADMIN_PASSWORD;
  if (!initial || initial.length < 10 || pw !== initial) return false;
  await q("insert into admin_credentials (id, password_hash) values (1, $1) on conflict (id) do nothing", [await hashPassword(pw)]);
  return true;
}

export async function setAdminPassword(pw: string) {
  const h = await hashPassword(pw);
  await q(
    `insert into admin_credentials (id, password_hash, updated_at) values (1, $1, now())
     on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now()`,
    [h],
  );
  // прежние сеансы закрываются
  await q("delete from admin_sessions");
}

export async function createSession(userAgent: string | null) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q("insert into admin_sessions (token_hash, expires_at, user_agent) values ($1, $2, $3)", [sha256(token), expires, userAgent?.slice(0, 200) ?? null]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    sameSite: "strict",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await q("delete from admin_sessions where token_hash = $1", [sha256(t)]);
  jar.delete(SESSION_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (!t || t.length > 100) return false;
  const r = await q("select 1 from admin_sessions where token_hash = $1 and expires_at > now()", [sha256(t)]);
  return r.rowCount === 1;
}
