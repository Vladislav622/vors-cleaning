"use client";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { paintStains } from "./stains";

const STAIN_SIZE = 512;
const APPEAR_S = 0.38; // появление новой модели
const LEAVE_S = 0.18; // уход старой модели

const smooth = (x: number) => x * x * (3 - 2 * x);
/** Лёгкий «перелёт» в конце появления */
const easeOutBack = (x: number) => {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export const modelUrl = (id: string) => `/models/${id}.glb`;

export interface CharacterRig {
  root: THREE.Object3D;
  eyes: THREE.Object3D[];
  armL: THREE.Object3D | null;
  armR: THREE.Object3D | null;
  face: THREE.Object3D[];
  upholstery: THREE.Mesh[];
  headAnchor: THREE.Vector3; // локальная точка над лицом
}

/** Клонирует сцену GLB, центрирует по полу и находит части персонажа по именам узлов из Blender */
export function useRig(id: string, opts: { cloneMaterials?: boolean } = {}): CharacterRig {
  const { scene } = useGLTF(modelUrl(id));
  return useMemo(() => {
    const root = scene.clone(true);
    if (opts.cloneMaterials) {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      });
    }
    const eyes: THREE.Object3D[] = [];
    const face: THREE.Object3D[] = [];
    const upholstery: THREE.Mesh[] = [];
    let armL: THREE.Object3D | null = null;
    let armR: THREE.Object3D | null = null;
    root.traverse((o) => {
      const n = o.name;
      if (/^Face_Eye[LR]/.test(n)) eyes.push(o);
      if (n.startsWith("Face_")) face.push(o);
      if (n.startsWith("Arm_L")) armL = o;
      if (n.startsWith("Arm_R")) armR = o;
      if (n.startsWith("Upholstery")) o.traverse((c) => (c as THREE.Mesh).isMesh && upholstery.push(c as THREE.Mesh));
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = false;
      }
    });
    // Центр по X/Z, основание на полу (без рук, чтобы модель не «прыгала»)
    const body = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.name.startsWith("Arm_")) body.expandByObject(m, true);
    });
    const c = body.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -body.min.y, -c.z);
    // точка над лицом
    const eyeBox = new THREE.Box3();
    eyes.forEach((e) => eyeBox.expandByObject(e));
    const headAnchor = eyes.length
      ? eyeBox.getCenter(new THREE.Vector3()).add(new THREE.Vector3(-c.x, -body.min.y, -c.z))
      : new THREE.Vector3(0, body.max.y - body.min.y, 0);
    return { root, eyes, armL, armR, face, upholstery, headAnchor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);
}

interface Props {
  id: string;
  scale: number;
  leaving: boolean;
  /** Ждать, пока предыдущая модель уйдёт, и только потом появляться */
  hold?: boolean;
  /** Показать пятна на обивке (сильные загрязнения) */
  dirty?: boolean;
  showFaces: boolean;
  reducedMotion: boolean;
  waveSignal: number;
  onGone?: () => void;
  onReady?: () => void;
  onTap?: () => void;
  anchorRef?: React.MutableRefObject<THREE.Vector3 | null>;
}

export function FurnitureModel({ id, scale, leaving, hold = false, dirty = false, showFaces, reducedMotion, waveSignal, onGone, onReady, onTap, anchorRef }: Props) {
  const rig = useRig(id);
  const group = useRef<THREE.Group>(null);
  // 0..1: насколько модель «на сцене»; при появлении растёт, при уходе падает
  const vis = useRef(0);
  const dirtK = useRef(dirty ? 1 : 0);
  const stainMeshes = useRef<THREE.Mesh[]>([]);

  // Слой пятен поверх обивки: рисуем один раз на модель, показываем/скрываем прозрачностью
  const stains = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = STAIN_SIZE;
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false; // как у текстур glTF
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 1 });
    return { canvas, tex, mat, ctx: canvas.getContext("2d")! };
  }, []);

  useLayoutEffect(() => {
    rig.root.updateMatrixWorld(true);
    const overlays = rig.upholstery.map((m) => {
      const o = new THREE.Mesh(m.geometry, stains.mat);
      o.raycast = () => {}; // касания считаем по самой обивке
      o.renderOrder = 2;
      o.visible = false;
      m.add(o);
      return o;
    });
    stains.ctx.clearRect(0, 0, STAIN_SIZE, STAIN_SIZE);
    paintStains(stains.ctx, rig.upholstery, 9, STAIN_SIZE);
    stains.tex.needsUpdate = true;
    stainMeshes.current = overlays;
    return () => {
      overlays.forEach((o) => o.removeFromParent());
      stainMeshes.current = [];
    };
  }, [rig, stains]);

  useEffect(() => () => {
    stains.tex.dispose();
    stains.mat.dispose();
  }, [stains]);
  const blink = useRef({ next: 1.5 + Math.random() * 3, t: -1 });
  const wave = useRef({ until: 0, start: 0 });
  const gone = useRef(false);

  useLayoutEffect(() => {
    rig.face.forEach((f) => (f.visible = showFaces));
    if (rig.armL) rig.armL.visible = showFaces;
    if (rig.armR) rig.armR.visible = showFaces;
  }, [rig, showFaces]);

  useEffect(() => {
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!waveSignal || reducedMotion || !showFaces) return;
    wave.current = { start: performance.now() / 1000, until: performance.now() / 1000 + 1.7 };
  }, [waveSignal, reducedMotion, showFaces]);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const now = state.clock.elapsedTime;
    const step = Math.min(dt, 1 / 20); // после паузы вкладки не перескакиваем анимацию
    // Смена модели анимируется всегда (короткое плавное появление/уход).
    // При «уменьшении движения» без перелёта и смещения — только мягкое масштабирование.
    if (leaving) vis.current = Math.max(0, vis.current - step / LEAVE_S);
    else if (!hold) vis.current = Math.min(1, vis.current + step / APPEAR_S);
    const v = vis.current;
    const k = leaving || reducedMotion ? smooth(v) : easeOutBack(v);
    const s = scale * Math.max(0, k);
    const breathe = reducedMotion ? 0 : Math.sin(now * 1.6) * 0.006;
    g.scale.set(s, s * (1 + breathe), s);
    g.position.y = reducedMotion ? 0 : leaving ? -0.08 * (1 - v) : 0.05 * (1 - v);
    g.visible = s > 0.002;

    // пятна проявляются и исчезают за ~0.3 с
    const dTarget = dirty ? 1 : 0;
    dirtK.current += (dTarget - dirtK.current) * Math.min(1, dt * 10);
    if (Math.abs(dirtK.current - dTarget) < 0.01) dirtK.current = dTarget;
    stains.mat.opacity = dirtK.current;
    const showStains = dirtK.current > 0.01;
    stainMeshes.current.forEach((o) => (o.visible = showStains));

    if (leaving && v <= 0 && !gone.current) {
      gone.current = true;
      onGone?.();
    }

    // Моргание: редкое, ~0.16 с
    if (!reducedMotion && showFaces) {
      const b = blink.current;
      if (b.t < 0 && now > b.next) b.t = 0;
      let k = 1;
      if (b.t >= 0) {
        b.t += dt;
        const p = b.t / 0.16;
        k = p < 0.5 ? 1 - p * 1.8 : 0.1 + (p - 0.5) * 1.8;
        if (p >= 1) {
          k = 1;
          b.t = -1;
          b.next = now + 2.8 + Math.random() * 4.5;
        }
      }
      rig.eyes.forEach((e) => (e.scale.y = Math.max(0.1, Math.min(1, k))));
    }

    // Приветствие рукой: подъём руки и покачивание, затем плавное опускание
    const w = wave.current;
    const tNow = performance.now() / 1000;
    let env = 0;
    if (tNow < w.until) {
      const p = (tNow - w.start) / (w.until - w.start);
      env = Math.sin(Math.min(1, p) * Math.PI);
    }
    if (rig.armR) rig.armR.rotation.z = env * (0.95 + Math.sin(tNow * 11) * 0.28);
    if (rig.armL) rig.armL.rotation.z = -env * 0.25;

    if (anchorRef && !leaving) {
      tmp.copy(rig.headAnchor);
      g.localToWorld(tmp);
      anchorRef.current = (anchorRef.current ?? new THREE.Vector3()).copy(tmp);
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // это было вращение, а не касание
    e.stopPropagation();
    onTap?.();
  };

  return (
    <group ref={group} onClick={onClick}>
      <primitive object={rig.root} />
    </group>
  );
}
