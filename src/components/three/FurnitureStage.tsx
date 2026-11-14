"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ALL_MODELS } from "@/lib/catalog";
import { FurnitureModel, modelUrl } from "./FurnitureModel";

export interface StageProps {
  modelId: string;
  scale: number;
  dirty: boolean;
  showFaces: boolean;
  reducedMotion: boolean;
  waveSignal: number;
  onTap: () => void;
  onReady: (id: string) => void;
  bubbleRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  resetSignal: number;
  active: boolean;
}

const CAM_POS = new THREE.Vector3(0.9, 1.25, 3.7);
const TARGET = new THREE.Vector3(0, 0.42, 0);

// Предзагрузка всех моделей: смена категории не ждёт сеть
if (typeof window !== "undefined") ALL_MODELS.forEach((m) => useGLTF.preload(modelUrl(m)));

type Slot = { key: number; id: string; leaving: boolean };

function Swapper(p: Omit<StageProps, "bubbleRef" | "containerRef" | "resetSignal" | "active"> & { anchorRef: React.MutableRefObject<THREE.Vector3 | null> }) {
  const [slots, setSlots] = useState<Slot[]>([{ key: 0, id: p.modelId, leaving: false }]);
  const counter = useRef(1);
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    invalidate();
    const t = setTimeout(() => invalidate(), 60);
    return () => clearTimeout(t);
  });
  useEffect(() => {
    setSlots((cur) => {
      const live = cur.find((s) => !s.leaving);
      if (live?.id === p.modelId) return cur;
      // оставляем максимум один уходящий предмет — быстрые переключения не копят модели
      const next = cur.filter((s) => !s.leaving).map((s) => ({ ...s, leaving: true }));
      return [...next, { key: counter.current++, id: p.modelId, leaving: false }];
    });
  }, [p.modelId]);
  const remove = useCallback((key: number) => setSlots((cur) => cur.filter((s) => s.key !== key)), []);
  // на узких экранах уменьшаем модель, чтобы она целиком помещалась в кадр
  const aspect = useThree((st) => st.size.width / Math.max(1, st.size.height));
  const fit = Math.min(1, Math.max(0.55, aspect / 1.3));
  // новая модель ждёт, пока старая полностью уйдёт, — без наложения двух предметов
  const someoneLeaving = slots.some((s) => s.leaving);
  return (
    <>
      {slots.map((s) => (
        <FurnitureModel
          key={s.key}
          id={s.id}
          scale={p.scale * fit}
          leaving={s.leaving}
          hold={!s.leaving && someoneLeaving}
          dirty={p.dirty}
          showFaces={p.showFaces}
          reducedMotion={p.reducedMotion}
          waveSignal={s.leaving ? 0 : p.waveSignal}
          onGone={() => remove(s.key)}
          onReady={() => p.onReady(s.id)}
          onTap={p.onTap}
          anchorRef={s.leaving ? undefined : p.anchorRef}
        />
      ))}
    </>
  );
}

/** Позиционирует реплику по проекции головы персонажа, держит её в пределах сцены и не закрывает глаза */
function BubbleTracker({ anchorRef, bubbleRef, containerRef }: { anchorRef: React.MutableRefObject<THREE.Vector3 | null>; bubbleRef: StageProps["bubbleRef"]; containerRef: StageProps["containerRef"] }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const el = bubbleRef.current;
    const a = anchorRef.current;
    if (!el || !a) return;
    v.copy(a).project(camera);
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    const bw = el.offsetWidth, bh = el.offsetHeight;
    const pad = 10, gap = 46; // gap — над глазами
    let left = x - bw * 0.25;
    let top = y - gap - bh;
    let side = "right";
    const topPad = 44; // ниже подписи над сценой
    if (top < topPad) {
      // мало места сверху: ставим сбоку от лица
      top = Math.max(topPad, y - bh / 2);
      left = x + 70;
      if (left + bw > size.width - pad) {
        left = x - 70 - bw;
        side = "left";
      }
    }
    left = Math.min(Math.max(pad, left), size.width - bw - pad);
    top = Math.min(Math.max(topPad, top), size.height - bh - 64); // не наезжаем на нижние кнопки
    el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    el.dataset.side = side;
  });
  void containerRef;
  return null;
}

function Controls({ resetSignal, reducedMotion }: { resetSignal: number; reducedMotion: boolean }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate } = useThree();
  const anim = useRef(0);
  useEffect(() => {
    if (!resetSignal) return;
    if (reducedMotion) {
      camera.position.copy(CAM_POS);
      ref.current?.target.copy(TARGET);
      ref.current?.update();
      invalidate();
    } else anim.current = 1;
  }, [resetSignal, reducedMotion, camera, invalidate]);
  useFrame((_, dt) => {
    if (anim.current <= 0 || !ref.current) return;
    const k = Math.min(1, dt * 6);
    camera.position.lerp(CAM_POS, k);
    ref.current.target.lerp(TARGET, k);
    ref.current.update();
    if (camera.position.distanceTo(CAM_POS) < 0.005) anim.current = 0;
  });
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={TARGET}
      enablePan={false}
      enableDamping={!reducedMotion}
      dampingFactor={0.09}
      rotateSpeed={0.85}
      minDistance={2.6}
      maxDistance={5.2}
      minPolarAngle={0.55}
      maxPolarAngle={1.42}
      zoomSpeed={0.6}
    />
  );
}

class ErrorBoundary extends Component<{ fallback: (retry: () => void) => ReactNode; children: ReactNode; onReset: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("3D не загрузилось", e);
  }
  render() {
    if (this.state.error)
      return this.props.fallback(() => {
        this.props.onReset();
        this.setState({ error: false });
      });
    return this.props.children;
  }
}

export default function FurnitureStage(props: StageProps & { fallback: (retry: () => void) => ReactNode }) {
  const anchorRef = useRef<THREE.Vector3 | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onReset = () => {
    ALL_MODELS.forEach((m) => useGLTF.clear(modelUrl(m)));
    setAttempt((a) => a + 1);
  };
  return (
    <ErrorBoundary fallback={props.fallback} onReset={onReset}>
      <Canvas
        key={attempt}
        dpr={[1, 1.75]}
        frameloop={props.active ? "always" : "never"}
        camera={{ position: CAM_POS.toArray(), fov: 30, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.95;
          gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
        }}
        aria-label="Трёхмерная модель выбранной мебели. Поворачивается пальцем или мышью."
        role="img"
      >
        <hemisphereLight args={["#ffffff", "#9fb3ac", 0.65]} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.9} />
        <directionalLight position={[-3, 2, -2.5]} intensity={0.45} />
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[0, 3, 2]} scale={[6, 2, 1]} />
          <Lightformer form="rect" intensity={0.8} position={[-4, 1, -1]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
          <Lightformer form="ring" intensity={0.6} position={[3, 1.5, -2]} scale={2} />
        </Environment>
        <Suspense fallback={null}>
          <Swapper
            modelId={props.modelId}
            scale={props.scale}
            dirty={props.dirty}
            showFaces={props.showFaces}
            reducedMotion={props.reducedMotion}
            waveSignal={props.waveSignal}
            onTap={props.onTap}
            onReady={props.onReady}
            anchorRef={anchorRef}
          />
        </Suspense>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.42} scale={5} blur={2.6} far={1.4} resolution={256} frames={Infinity} color="#1a2622" />
        <BubbleTracker anchorRef={anchorRef} bubbleRef={props.bubbleRef} containerRef={props.containerRef} />
        <Controls resetSignal={props.resetSignal} reducedMotion={props.reducedMotion} />
      </Canvas>
    </ErrorBoundary>
  );
}
