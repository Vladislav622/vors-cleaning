// При сборке на хостинге: если задан DATABASE_URL — применяем схему и стартовые настройки (идемпотентно).
// Локально без DATABASE_URL просто пропускаем.
import { execFileSync } from "node:child_process";
if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL не задан — пропускаю миграцию.");
} else {
  execFileSync("node", ["scripts/migrate.mjs"], { stdio: "inherit" });
  execFileSync("node", ["scripts/seed.mjs", ...(process.env.SEED_DEMO === "1" ? ["--demo"] : [])], { stdio: "inherit" });
}
