"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_BY_ID, modelFor, type CategoryId, type VariantId } from "@/lib/catalog";
import { PHRASES, pick } from "@/lib/phrases";
import { formatMoney, unitPrice } from "@/lib/pricing";
import type { PublicSettings } from "@/lib/settings-schema";
import { addToCart, useCart, useHydrated } from "@/lib/client/store";
import { openCart } from "@/lib/client/ui-events";
import { Stepper, Switch } from "./ui";

const FurnitureStage = dynamic(() => import("./three/FurnitureStage"), { ssr: false });

interface CatState {
  variant: VariantId | null;
  heavy: boolean;
  secondSide: boolean;
  qty: number;
  description: string;
}
const initialState = (): Record<CategoryId, CatState> =>
  Object.fromEntries(
    CATEGORIES.map((c) => [c.id, { variant: c.variants[0]?.id ?? null, heavy: false, secondSide: false, qty: c.id === "chair" ? 4 : 1, description: "" }]),
  ) as Record<CategoryId, CatState>;

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Configurator({ settings, initialCategory }: { settings: PublicSettings; initialCategory?: CategoryId }) {
  const { pricing, characters } = settings;
  const [cat, setCat] = useState<CategoryId>(initialCategory ?? "sofa");
  const [state, setState] = useState(initialState);
  const cur = state[cat];
  const category = CATEGORY_BY_ID[cat];
  const reduced = !!useReducedMotion();
  const cart = useCart();
  const hydrated = useHydrated();
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(true);
  const [waveSignal, setWave] = useState(0);
  const [resetSignal, setReset] = useState(0);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [descErr, setDescErr] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const phraseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const modelId = modelFor(cat, cur.variant);
  const lines = PHRASES[characters.preset][cat];
  const talk = useCallback(
    (text: string) => {
      if (!characters.showPhrases) return;
      setPhrase(text);
      clearTimeout(phraseTimer.current);
      phraseTimer.current = setTimeout(() => setPhrase(null), 4800);
    },
    [characters.showPhrases],
  );

  useEffect(() => setWebgl(hasWebGL()), []);
  useEffect(() => {
    document.body.classList.add("has-mobile-bar");
    return () => document.body.classList.remove("has-mobile-bar");
  }, []);

  // Рендерим 3D только когда сцена видна и вкладка активна
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      update();
    }, { threshold: 0.05 });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [webgl]);

  // Приветствие при смене категории
  useEffect(() => {
    const t = setTimeout(() => {
      talk(pick(lines.hello));
      setWave((w) => w + 1);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, characters.preset]);

  // Редкие фразы в простое
  const phraseRef = useRef<string | null>(null);
  phraseRef.current = phrase;
  useEffect(() => {
    if (!visible || !characters.showPhrases) return;
    const id = setInterval(() => talk(pick(lines.idle, phraseRef.current ?? undefined)), 18000);
    return () => clearInterval(id);
  }, [visible, characters.showPhrases, lines, talk]);

  const patch = (p: Partial<CatState>) => setState((s) => ({ ...s, [cat]: { ...s[cat], ...p } }));

  const unit = useMemo(
    () => unitPrice({ category: cat, variant: cur.variant, qty: cur.qty, heavy: cur.heavy, secondSide: cur.secondSide }, pricing),
    [cat, cur, pricing],
  );

  const add = () => {
    if (cat === "other" && cur.description.trim().length < 3) {
      setDescErr("Опишите предмет: что это, ткань, размер");
      document.getElementById("other-desc")?.focus();
      return;
    }
    addToCart({
      category: cat,
      variant: cat === "other" ? null : cur.variant,
      qty: cur.qty,
      heavy: cur.heavy,
      secondSide: !!category.hasSecondSide && cur.secondSide,
      description: cat === "other" ? cur.description.trim() : "",
    });
    if (cat === "other") patch({ description: "" });
    setToast(`${category.label} в заявке`);
    talk(pick(lines.tap));
    setWave((w) => w + 1);
  };
  useEffect(() => {
    const hide = () => setToast(null);
    window.addEventListener("vors:open-cart", hide);
    return () => window.removeEventListener("vors:open-cart", hide);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const priceText = unit == null ? "По фото" : formatMoney(unit * cur.qty, pricing.currency);
  const loading = webgl === true && !readyIds.has(modelId);

  const poster = (
    <div className="stage-poster">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/posters/${modelId}.webp`} alt={`${category.label}: иллюстрация`} width={900} height={700} />
    </div>
  );

  return (
    <div className="wrap">
      <h1 className="hero-title">Покажите, что почистить — посчитаем сразу</h1>
      <p className="hero-sub">Выберите мебель и отметьте особенности. Мастер перезвонит, уточнит детали и время выезда. Цена на сайте предварительная.</p>
      <section className="config" aria-label="Выбор мебели и расчёт">
        <div className="stage" ref={containerRef}>
          {webgl === false && (
            <>
              {poster}
              <p className="stage-note">3D недоступно в этом браузере — показываем картинку. Заказ работает как обычно.</p>
            </>
          )}
          {webgl && (
            <FurnitureStage
              modelId={modelId}
              scale={category.sceneScale}
              showFaces={characters.showFaces}
              reducedMotion={reduced}
              waveSignal={waveSignal}
              onTap={() => {
                talk(pick(lines.tap, phraseRef.current ?? undefined));
                setWave((w) => w + 1);
              }}
              onReady={(id) => setReadyIds((s) => (s.has(id) ? s : new Set(s).add(id)))}
              bubbleRef={bubbleRef}
              containerRef={containerRef}
              resetSignal={resetSignal}
              active={visible}
              fallback={(retry) => (
                <>
                  {poster}
                  <div className="stage-ui">
                    <span className="stage-hint">3D не загрузилось. Заказ доступен.</span>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={retry}>
                      Повторить
                    </button>
                  </div>
                </>
              )}
            />
          )}
          {loading && (
            <div className="stage-center" aria-live="polite">
              <div>
                <div className="loader-dot" />
                <span className="muted">Загружаем модель…</span>
              </div>
            </div>
          )}
          {webgl && characters.showPhrases && (
            <div
              ref={bubbleRef}
              className="bubble"
              role="status"
              aria-live="polite"
              style={{ opacity: phrase && !loading ? 1 : 0, transition: "opacity .25s", visibility: phrase ? "visible" : "hidden" }}
            >
              {phrase}
            </div>
          )}
          {webgl && (
            <>
              <p className="stage-note">Модель показывает тип мебели. Размер и ткань уточнит мастер.</p>
              <div className="stage-ui">
                <span className="stage-hint">Крутите пальцем или мышью</span>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setReset((r) => r + 1)}>
                  Сбросить ракурс
                </button>
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <div className="chips" role="group" aria-label="Что чистим">
            {CATEGORIES.map((c) => (
              <button key={c.id} className="chip" type="button" aria-pressed={c.id === cat} onClick={() => setCat(c.id)}>
                {c.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={cat}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="stack"
            >
              {category.variants.length > 0 && (
                <div className="seg" role="group" aria-label="Вариант">
                  {category.variants.map((v) => (
                    <button key={v.id} type="button" aria-pressed={cur.variant === v.id} onClick={() => patch({ variant: v.id })}>
                      {v.label}
                      <small>{v.hint}</small>
                    </button>
                  ))}
                </div>
              )}

              {cat === "other" && (
                <div className="field">
                  <label htmlFor="other-desc">Что за предмет?</label>
                  <textarea
                    id="other-desc"
                    className="textarea"
                    placeholder="Например: пуф 60×60, велюр, пятно от кофе"
                    value={cur.description}
                    maxLength={500}
                    aria-invalid={!!descErr}
                    aria-describedby="other-hint"
                    onChange={(e) => {
                      patch({ description: e.target.value });
                      setDescErr(null);
                    }}
                  />
                  {descErr ? <span className="err">{descErr}</span> : null}
                  <span className="hint" id="other-hint">
                    Цену назовём по фото — приложите его при оформлении заявки.
                  </span>
                </div>
              )}

              <div>
                {category.hasSecondSide && (
                  <div className="toggle-row">
                    <div>
                      <div className="label">Вторая сторона</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        +{pricing.secondSidePct}% к цене матраса
                      </div>
                    </div>
                    <Switch checked={cur.secondSide} onChange={(v) => patch({ secondSide: v })} label="Чистить вторую сторону" />
                  </div>
                )}
                <div className="toggle-row">
                  <div>
                    <div className="label">Сильные загрязнения</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {cat === "other" ? "Учтём при оценке по фото" : `Пятна, запахи, шерсть: +${pricing.heavySoilingPct}%`}
                    </div>
                  </div>
                  <Switch checked={cur.heavy} onChange={(v) => patch({ heavy: v })} label="Сильные загрязнения" />
                </div>
                <div className="toggle-row">
                  <div className="label">Количество</div>
                  <Stepper value={cur.qty} min={1} max={20} onChange={(v) => patch({ qty: v })} label="Количество" />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="price-line" aria-live="polite">
            <div>
              <div className="price-big">{priceText}</div>
              <div className="price-note">
                {unit == null
                  ? "Мастер назовёт цену после фото"
                  : cur.qty > 1
                    ? `${formatMoney(unit, pricing.currency)} за штуку. Минимальный заказ — ${formatMoney(pricing.minOrder, pricing.currency)}`
                    : `Минимальный заказ — ${formatMoney(pricing.minOrder, pricing.currency)}`}
              </div>
            </div>
          </div>
          <button className="btn btn-primary btn-block" type="button" onClick={add}>
            Добавить в заявку
          </button>
          {hydrated && cartCount > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} type="button" onClick={() => openCart()}>
                Корзина ({cartCount})
              </button>
              <Link className="btn btn-ghost" style={{ flex: 1 }} href="/checkout">
                Оформить
              </Link>
            </div>
          )}
        </div>
      </section>

      <div className="mobile-bar">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800 }} className="num">
            {priceText}
          </div>
          <div className="price-note">{category.label}</div>
        </div>
        <button className="btn btn-primary" type="button" onClick={add}>
          Добавить
        </button>
        {hydrated && cartCount > 0 && (
          <button className="icon-btn" type="button" onClick={() => openCart()} aria-label={`Корзина, предметов: ${cartCount}`}>
            <span className="num" style={{ fontWeight: 800 }}>
              {cartCount}
            </span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 12, x: "-50%" }}
          >
            <span>{toast}</span>
            <button type="button" onClick={() => openCart()}>
              Открыть корзину
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
