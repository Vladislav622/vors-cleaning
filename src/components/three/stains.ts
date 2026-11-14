import * as THREE from "three";

/** Случайные пятна в UV-пространстве, только на видимых спереди и сверху участках обивки */
export function paintStains(ctx: CanvasRenderingContext2D, meshes: THREE.Mesh[], count: number, size = 512) {
  type Tri = { area: number; uv: [THREE.Vector2, THREE.Vector2, THREE.Vector2] };
  const tris: Tri[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const view = new THREE.Vector3(0.25, 0.45, 1).normalize();
  for (const m of meshes) {
    const g = m.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute("position");
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    if (!pos || !uv) continue;
    const idx = g.getIndex();
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      n.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      const area = n.length() / 2;
      if (area < 1e-6) continue;
      n.normalize();
      if (n.dot(view) < 0.35 || Math.min(a.y, b.y, c.y) < 0.05) continue;
      tris.push({ area, uv: [new THREE.Vector2().fromBufferAttribute(uv, i0), new THREE.Vector2().fromBufferAttribute(uv, i1), new THREE.Vector2().fromBufferAttribute(uv, i2)] });
    }
  }
  const total = tris.reduce((s, t) => s + t.area, 0);
  if (!total) return;
  for (let k = 0; k < count; k++) {
    let r = Math.random() * total;
    const t = tris.find((x) => (r -= x.area) <= 0) ?? tris[tris.length - 1];
    let u = Math.random(), v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const p = t.uv[0].clone().multiplyScalar(1 - u - v).add(t.uv[1].clone().multiplyScalar(u)).add(t.uv[2].clone().multiplyScalar(v));
    const x = p.x * size, y = p.y * size;
    const hue = [28, 35, 20, 8][k % 4];
    for (let j = 0; j < 5; j++) {
      const rr = 6 + Math.random() * 12;
      const ox = x + (Math.random() - 0.5) * 16, oy = y + (Math.random() - 0.5) * 16;
      const gr = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
      gr.addColorStop(0, `hsla(${hue}, 45%, 26%, 0.95)`);
      gr.addColorStop(0.7, `hsla(${hue}, 40%, 30%, 0.8)`);
      gr.addColorStop(1, `hsla(${hue}, 40%, 30%, 0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(ox, oy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
