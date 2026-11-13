"use client";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

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
  showFaces: boolean;
  reducedMotion: boolean;
  waveSignal: number;
  onGone?: () => void;
  onReady?: () => void;
  onTap?: () => void;
  anchorRef?: React.MutableRefObject<THREE.Vector3 | null>;
}

export function FurnitureModel({ id, scale, leaving, showFaces, reducedMotion, waveSignal, onGone, onReady, onTap, anchorRef }: Props) {
  const rig = useRig(id);
  const group = useRef<THREE.Group>(null);
  const appear = useRef(reducedMotion ? 1 : 0);
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
    const target = leaving ? 0 : 1;
    if (reducedMotion) appear.current = target;
    else appear.current += (target - appear.current) * Math.min(1, dt * (leaving ? 14 : 9));
    const a = appear.current;
    const s = scale * (leaving ? 0.7 + 0.3 * a : 0.86 + 0.14 * a);
    const breathe = reducedMotion ? 0 : Math.sin(now * 1.6) * 0.006;
    g.scale.set(s, s * (1 + breathe), s);
    g.position.y = leaving ? -0.15 * (1 - a) : -0.06 * (1 - a);
    g.visible = a > 0.02;
    if (leaving && a < 0.03 && !gone.current) {
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
