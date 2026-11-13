import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// DATE отдаём строкой YYYY-MM-DD, без сдвига часового пояса
types.setTypeParser(1082, (v: string) => v);

declare global {
  var __vorsPool: Pool | undefined;
}

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан");
  const ssl = /sslmode=require|neon\.tech|supabase\.co/.test(url) ? { rejectUnauthorized: false } : undefined;
  return new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 5), ssl, idleTimeoutMillis: 10_000 });
}

export function pool(): Pool {
  if (!globalThis.__vorsPool) globalThis.__vorsPool = makePool();
  return globalThis.__vorsPool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return pool().query<T>(text, params);
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
