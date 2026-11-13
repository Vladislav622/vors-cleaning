"use client";
import { useState } from "react";
import { CATEGORIES } from "@/lib/catalog";
import { PHRASES } from "@/lib/phrases";
import { formatMoney, quote } from "@/lib/pricing";
import type { Settings } from "@/lib/settings-schema";
import { Switch } from "../ui";
import { api, ApiError } from "./api";

type Section = keyof Settings;

function NumField({ label, value, onChange, suffix, err, hint }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; err?: string; hint?: string }) {
  const [raw, setRaw] = useState(String(value));
  return (
    <div className="field">
      <label>
        {label}
        {suffix ? `, ${suffix}` : ""}
      </label>
      <input
        className="input num"
        inputMode="decimal"
        value={raw}
        aria-invalid={!!err}
        onChange={(e) => {
          setRaw(e.target.value);
          const n = Number(e.target.value.replace(/\s/g, "").replace(",", "."));
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      {hint && <span className="hint">{hint}</span>}
      {err && <span className="err">{err}</span>}
    </div>
  );
}

function TextField({ label, value, onChange, err, hint, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; err?: string; hint?: string; type?: string; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={!!err} />
      {hint && <span className="hint">{hint}</span>}
      {err && <span className="err">{err}</span>}
    </div>
  );
}

const TITLES: Record<Section, [string, string]> = {
  pricing: ["Тарифы", "Новые цены действуют для новых заявок. Отправленные заявки хранят прайс на момент отправки."],
  company: ["Компания", "Название, контакты и территория появляются на сайте сразу после сохранения."],
  game: ["Игра", "Мини-игра на странице заявки. Бонус применяется вручную: защищённого античита и автоматического погашения нет."],
  characters: ["Персонажи", "Характер реплик и отображение лиц у 3D-мебели."],
};

export default function SettingsForm({ section, initial }: { section: Section; initial: Settings }) {
  const [s, setS] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const p = s.pricing, c = s.company, g = s.game, ch = s.characters;
  const setP = (patch: Partial<Settings["pricing"]>) => setS({ ...s, pricing: { ...p, ...patch } });
  const setC = (patch: Partial<Settings["company"]>) => setS({ ...s, company: { ...c, ...patch } });
  const setG = (patch: Partial<Settings["game"]>) => setS({ ...s, game: { ...g, ...patch } });
  const setCh = (patch: Partial<Settings["characters"]>) => setS({ ...s, characters: { ...ch, ...patch } });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErrors({});
    try {
      const next = await api<Settings>("/api/admin/settings", { method: "PUT", json: { section, value: s[section] } });
      setS(next);
      setMsg({ ok: true, text: "Сохранено" });
    } catch (err) {
      const ae = err as ApiError;
      setErrors(ae.fieldErrors ?? {});
      setMsg({ ok: false, text: ae.message });
    } finally {
      setBusy(false);
    }
  };

  const example = quote(
    [
      { category: "sofa", variant: "sofa-3", qty: 1, heavy: true },
      { category: "mattress", variant: "mattress-double", qty: 1, heavy: false, secondSide: true },
    ],
    true,
    p,
  );

  return (
    <form className="stack" onSubmit={save} style={{ maxWidth: 900 }}>
      <div>
        <h1 style={{ margin: "4px 0", fontSize: 26 }}>{TITLES[section][0]}</h1>
        <p className="muted" style={{ margin: 0 }}>{TITLES[section][1]}</p>
      </div>

      {section === "pricing" && (
        <>
          {CATEGORIES.filter((cat) => cat.variants.length).map((cat) => (
            <div className="card stack" key={cat.id}>
              <h2 style={{ margin: 0, fontSize: 17 }}>{cat.plural}</h2>
              <div className="price-grid">
                {cat.variants.map((v) => (
                  <NumField key={v.id} label={v.label} suffix={p.currency} value={p.variants[v.id]} err={errors[`variants.${v.id}`]} onChange={(n) => setP({ variants: { ...p.variants, [v.id]: Math.round(n) } })} />
                ))}
              </div>
            </div>
          ))}
          <div className="card stack">
            <h2 style={{ margin: 0, fontSize: 17 }}>Надбавки и правила</h2>
            <div className="price-grid">
              <NumField label="Минимальный заказ" suffix={p.currency} value={p.minOrder} err={errors.minOrder} onChange={(n) => setP({ minOrder: Math.round(n) })} hint="Только на чистку, без выезда" />
              <NumField label="Сильные загрязнения" suffix="%" value={p.heavySoilingPct} err={errors.heavySoilingPct} onChange={(n) => setP({ heavySoilingPct: n })} />
              <NumField label="Вторая сторона матраса" suffix="%" value={p.secondSidePct} err={errors.secondSidePct} onChange={(n) => setP({ secondSidePct: n })} />
              <NumField label="Выезд за город" suffix={p.currency} value={p.outOfTownFee} err={errors.outOfTownFee} onChange={(n) => setP({ outOfTownFee: Math.round(n) })} hint="Фиксированная доплата" />
              <NumField label="Шаг округления" suffix={p.currency} value={p.roundingStep} err={errors.roundingStep} onChange={(n) => setP({ roundingStep: Math.round(n) })} hint="Цена за штуку округляется вверх" />
              <TextField label="Валюта" value={p.currency} err={errors.currency} onChange={(v) => setP({ currency: v })} />
            </div>
            <div className="notice">
              Порядок расчёта: цена варианта × (1 + вторая сторона) × (1 + загрязнения) → округление вверх → × количество. Затем минимальный заказ, затем выезд.
              <br />
              Пример: диван на 3 места с загрязнениями + двуспальный матрас с двумя сторонами + выезд за город = <strong className="num">{formatMoney(example.totalFrom, p.currency)}</strong>.
            </div>
          </div>
        </>
      )}

      {section === "company" && (
        <div className="card stack">
          <div className="row-2">
            <TextField label="Название" value={c.name} err={errors.name} onChange={(v) => setC({ name: v })} />
            <TextField label="Подзаголовок" value={c.tagline} err={errors.tagline} onChange={(v) => setC({ tagline: v })} />
            <TextField label="Город" value={c.city} err={errors.city} onChange={(v) => setC({ city: v })} />
            <TextField label="Территория выезда" value={c.territory} err={errors.territory} onChange={(v) => setC({ territory: v })} placeholder="Город и пригород до 25 км" />
            <TextField label="Телефон" type="tel" value={c.phone} err={errors.phone} onChange={(v) => setC({ phone: v })} hint="Пусто — кнопка звонка не показывается" />
            <TextField label="WhatsApp (номер)" value={c.whatsapp} err={errors.whatsapp} onChange={(v) => setC({ whatsapp: v })} />
            <TextField label="Telegram (имя без @)" value={c.telegram} err={errors.telegram} onChange={(v) => setC({ telegram: v })} />
            <TextField label="Email" type="email" value={c.email} err={errors.email} onChange={(v) => setC({ email: v })} />
            <TextField label="Часы работы" value={c.workHours} err={errors.workHours} onChange={(v) => setC({ workHours: v })} />
            <TextField label="Юр. лицо или ИП для политики" value={c.legalName} err={errors.legalName} onChange={(v) => setC({ legalName: v })} />
          </div>
          <div className="field">
            <label htmlFor="acc">Акцентный цвет</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input id="acc" type="color" value={c.accent} onChange={(e) => setC({ accent: e.target.value })} style={{ width: 56, height: 44, border: 0, background: "none" }} />
              <input className="input" value={c.accent} onChange={(e) => setC({ accent: e.target.value })} style={{ maxWidth: 140 }} aria-invalid={!!errors.accent} />
            </div>
            {errors.accent && <span className="err">Цвет в формате #RRGGBB</span>}
            <span className="hint">Логотип, полная палитра и иконки PWA меняются в исходниках — см. ADAPTATION.md.</span>
          </div>
          <div className="toggle-row">
            <div>
              <div className="label">Демо-режим</div>
              <div className="muted" style={{ fontSize: 13 }}>Показывает плашку «компания и контакты вымышленные»</div>
            </div>
            <Switch checked={c.demo} onChange={(v) => setC({ demo: v })} label="Демо-режим" />
          </div>
        </div>
      )}

      {section === "game" && (
        <div className="card stack">
          <div className="seg" role="group" aria-label="Режим игры">
            {(
              [
                ["off", "Выключена"],
                ["play", "Без скидки"],
                ["bonus", "С бонусом"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={g.mode === k} onClick={() => setG({ mode: k })}>
                {l}
              </button>
            ))}
          </div>
          {g.mode === "bonus" && (
            <div className="price-grid">
              <NumField label="Сумма бонуса" suffix={p.currency} value={g.bonusAmount} err={errors.bonusAmount} onChange={(n) => setG({ bonusAmount: Math.round(n) })} />
              <NumField label="Срок действия" suffix="дней" value={g.validDays} err={errors.validDays} onChange={(n) => setG({ validDays: Math.round(n) })} />
              <NumField label="Минимум следующей чистки" suffix={p.currency} value={g.minNextOrder} err={errors.minNextOrder} onChange={(n) => setG({ minNextOrder: Math.round(n) })} />
            </div>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Один код на заявку. Текущий заказ не дешевеет. Факт прохождения игры сообщает браузер клиента, поэтому проверяйте код и отмечайте его использованным в карточке заявки.
          </p>
        </div>
      )}

      {section === "characters" && (
        <div className="card stack">
          <div className="seg" role="group" aria-label="Характер">
            {(
              [
                ["cheerful", "Весёлый"],
                ["calm", "Спокойный"],
                ["laconic", "Немногословный"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={ch.preset === k} onClick={() => setCh({ preset: k })}>
                {l}
              </button>
            ))}
          </div>
          <div className="notice">Пример: «{PHRASES[ch.preset].sofa.hello[0]}»</div>
          <div className="toggle-row">
            <div className="label">Показывать лица и руки</div>
            <Switch checked={ch.showFaces} onChange={(v) => setCh({ showFaces: v })} label="Показывать лица" />
          </div>
          <div className="toggle-row">
            <div className="label">Показывать реплики</div>
            <Switch checked={ch.showPhrases} onChange={(v) => setCh({ showPhrases: v })} label="Показывать реплики" />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Тексты реплик лежат в src/lib/phrases.ts — их можно переписать под компанию.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
        {msg && <span className={msg.ok ? "saved" : "err"} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}
