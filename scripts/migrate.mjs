// Применяет db/schema.sql к DATABASE_URL. Схема идемпотентна.
import { readFileSync } from "node:fs";
import pg from "pg";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL не задан"); process.exit(1); }
const ssl = /sslmode=require|neon\.tech|supabase\.co/.test(url) ? { rejectUnauthorized: false } : undefined;
const c = new pg.Client({ connectionString: url, ssl });
await c.connect();
await c.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("Схема применена.");
await c.end();
