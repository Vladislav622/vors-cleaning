// Оптимизация GLB: dedup, weld, quantize, meshopt-сжатие. Источник: assets-src/glb, результат: public/models
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const src = "assets-src/glb", dst = "public/models";
for (const f of readdirSync(src).filter((x) => x.endsWith(".glb"))) {
  const tmp = join("/tmp", f);
  const cli = ["node_modules/.bin/gltf-transform"];
  execFileSync(cli[0], ["weld", join(src, f), tmp], { stdio: "inherit" });
  execFileSync(cli[0], ["meshopt", tmp, join(dst, f), "--level", "medium"], { stdio: "inherit" });
  console.log(f, statSync(join(src, f)).size, "->", statSync(join(dst, f)).size);
}
