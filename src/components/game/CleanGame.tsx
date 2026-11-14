"use client";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CATEGORY_BY_ID, VARIANT_BY_ID, type VariantId } from "@/lib/catalog";
import { useRig } from "../three/FurnitureModel";
import { paintStains } from "../three/stains";

const SIZE = 512;
const BRUSH = 20;

function sceneScaleFor(model: string) {
  const v = VARIANT_BY_ID[model as VariantId];
  return CATEGORY_BY_ID[v ? v.category : "other"].sceneScale;
}

function dirtyAmount(canvas: HTMLCanvasElement, small: HTMLCanvasElement): number {
  const s = small.getContext("2d", { willReadFrequently: true })!;
  s.clearRect(0, 0, small.width, small.height);
  s.drawImage(canvas, 0, 0, small.width, small.height);
  const d = s.getImageData(0, 0, small.width, small.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
  return n;
}

function GameScene({ model, mode, showFaces, onProgress }: { model: string; mode: "clean" | "rotate"; showFaces: boolean; onProgress: (p: number) => void }) {
  const rig = useRig(model);
  const { invalidate } = useThree();
  const aspect = useThree((st) => st.size.width / Math.max(1, st.size.height));
  const scale = sceneScaleFor(model) * Math.min(1, Math.max(0.5, aspect / 1.35));
  const painting = useRef(false);
  const last = useRef<THREE.Vector2 | null>(null);
  const lastCheck = useRef(0);

  const dirt = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const small = document.createElement("canvas");
    small.width = small.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false; // как у текстур glTF
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 1 });
    return { canvas, small, tex, mat, ctx: canvas.getContext("2d")!, initial: 0 };
  }, []);

  useLayoutEffect(() => {
    rig.face.forEach((f) => (f.visible = showFaces));
    if (rig.armL) rig.armL.visible = showFaces;
    if (rig.armR) rig.armR.visible = showFaces;
    rig.root.updateMatrixWorld(true);
    const overlays = rig.upholstery.map((m) => {
      const o = new THREE.Mesh(m.geometry, dirt.mat);
      o.raycast = () => {}; // попадания считаем по самой обивке
      o.renderOrder = 2;
      m.add(o);
      return o;
    });
    dirt.ctx.clearRect(0, 0, SIZE, SIZE);
    paintStains(dirt.ctx, rig.upholstery, 9);
    dirt.tex.needsUpdate = true;
    dirt.initial = Math.max(1, dirtyAmount(dirt.canvas, dirt.small));
    onProgress(0);
    invalidate();
    return () => {
      overlays.forEach((o) => o.removeFromParent());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rig]);

  useEffect(() => () => {
    dirt.tex.dispose();
    dirt.mat.dispose();
  }, [dirt]);

  const erase = (uv: THREE.Vector2) => {
    const ctx = dirt.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const from = last.current && last.current.distanceTo(uv) < 0.08 ? last.current : uv;
    const steps = Math.max(1, Math.ceil((from.distanceTo(uv) * SIZE) / (BRUSH / 2)));
    for (let i = 0; i <= steps; i++) {
      const p = from.clone().lerp(uv, i / steps);
      const g = ctx.createRadialGradient(p.x * SIZE, p.y * SIZE, 0, p.x * SIZE, p.y * SIZE, BRUSH);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.6, "rgba(0,0,0,0.9)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x * SIZE, p.y * SIZE, BRUSH, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    last.current = uv.clone();
    dirt.tex.needsUpdate = true;
    const now = performance.now();
    if (now - lastCheck.current > 180) {
      lastCheck.current = now;
      const left = dirtyAmount(dirt.canvas, dirt.small);
      let p = 1 - left / dirt.initial;
      if (p > 0.9) {
        dirt.ctx.clearRect(0, 0, SIZE, SIZE);
        dirt.tex.needsUpdate = true;
        p = 1;
      }
      onProgress(p);
    }
    invalidate();
  };

  const hit = (e: ThreeEvent<PointerEvent>) => {
    const first = e.intersections[0];
    if (!first || !first.uv) return;
    if (!rig.upholstery.includes(first.object as THREE.Mesh)) return; // глаза, ножки и руки закрывают обивку
    erase(first.uv);
  };

  return (
    <group
      scale={scale}
      onPointerDown={(e) => {
        if (mode !== "clean") return;
        e.stopPropagation();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        painting.current = true;
        last.current = null;
        hit(e);
      }}
      onPointerMove={(e) => {
        if (mode !== "clean" || !painting.current) return;
        e.stopPropagation();
        hit(e);
      }}
      onPointerUp={() => {
        painting.current = false;
        last.current = null;
      }}
      onPointerLeave={() => {
        painting.current = false;
        last.current = null;
      }}
    >
      <primitive object={rig.root} />
    </group>
  );
}

export default function CleanGame({ model, onWin, onClose, showFaces }: { model: string; onWin: () => void; onClose: () => void; showFaces: boolean }) {
  const [mode, setMode] = useState<"clean" | "rotate">("clean");
  const [progress, setProgress] = useState(0);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const won = useRef(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setWebgl(false);
    }
  }, []);
  useEffect(() => {
    if (progress >= 1 && !won.current) {
      won.current = true;
      onWin();
    }
  }, [progress, onWin]);

  if (webgl === false) return <p className="muted">Для игры нужен браузер с поддержкой 3D. На заявку это не влияет.</p>;
  const pct = Math.round(progress * 100);

  return (
    <div className="game">
      <div className="seg" role="group" aria-label="Режим">
        <button type="button" aria-pressed={mode === "clean"} onClick={() => setMode("clean")}>
          Чистить
        </button>
        <button type="button" aria-pressed={mode === "rotate"} onClick={() => setMode("rotate")}>
          Повернуть
        </button>
      </div>
      <div className="game-stage" data-mode={mode} style={{ touchAction: "none" }}>
        {webgl && (
          <Canvas key={round} dpr={[1, 1.75]} frameloop="demand" camera={{ position: [0.6, 1.3, 3.6], fov: 30 }} gl={{ antialias: true, alpha: true }}>
            <hemisphereLight args={["#ffffff", "#b9c7c2", 0.9]} />
            <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
            <Environment resolution={64} frames={1}>
              <Lightformer form="rect" intensity={2} position={[0, 3, 2]} scale={[6, 2, 1]} />
            </Environment>
            <Suspense fallback={null}>
              <GameScene model={model} mode={mode} showFaces={showFaces} onProgress={setProgress} />
            </Suspense>
            <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={5} blur={2.6} far={1.4} resolution={256} frames={Infinity} />
            <OrbitControls makeDefault enabled={mode === "rotate"} enablePan={false} target={[0, 0.42, 0]} minDistance={2.4} maxDistance={5} minPolarAngle={0.5} maxPolarAngle={1.45} />
          </Canvas>
        )}
      </div>
      <div>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Очищено">
          <div style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 14 }}>
          <span className="muted">{mode === "clean" ? "Водите пальцем по пятнам" : "Поверните модель, чтобы найти пятна"}</span>
          <strong className="num">{pct}%</strong>
        </div>
      </div>
      {progress >= 1 && <div className="notice">Чисто! Так же аккуратно мастер поработает и с вашей мебелью.</div>}
      <div style={{ display: "flex", gap: 8 }}>
        {progress >= 1 && (
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setProgress(0);
              setRound((r) => r + 1);
            }}
          >
            Ещё раз
          </button>
        )}
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Закрыть игру
        </button>
      </div>
    </div>
  );
}
