"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAX_PHOTOS } from "@/lib/order-schema";
import type { Pricing } from "@/lib/settings-schema";
import { clearAfterOrder, draftStore, useCart, useDraft, useHydrated, type Draft, type DraftPhoto } from "@/lib/client/store";
import { CartLine, EmptyCart, Totals, UndoToast, useUndoRemove } from "./CartSheet";
import { Switch } from "./ui";

type Pending = { localId: string; file: File; preview: string; status: "uploading" | "error"; error?: string };
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

async function makeThumb(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = 200 / Math.max(img.width, img.height);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

const isoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = () => isoLocal(new Date());
const maxDate = () => isoLocal(new Date(Date.now() + 179 * 864e5));

export default function CheckoutForm({ pricing, privacyHref }: { pricing: Pricing; privacyHref: string }) {
  const items = useCart();
  const draft = useDraft();
  const hydrated = useHydrated();
  const router = useRouter();
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { undo, remove, restore } = useUndoRemove();
  const needsPhoto = items.some((i) => i.category === "other");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    draftStore.set((d) => ({ ...d, [k]: v }));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function upload(p: Pending) {
    setPending((list) => list.map((x) => (x.localId === p.localId ? { ...x, status: "uploading", error: undefined } : x)));
    try {
      const fd = new FormData();
      fd.append("file", p.file);
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Не получилось загрузить фото.");
      const photo: DraftPhoto = { id: j.id, secret: j.secret, preview: p.preview };
      draftStore.set((d) => ({ ...d, photos: [...d.photos, photo].slice(0, MAX_PHOTOS) }));
      setPending((list) => list.filter((x) => x.localId !== p.localId));
      setErrors((e) => ({ ...e, photos: "" }));
    } catch (e) {
      const msg = e instanceof TypeError ? "Нет связи. Повторите загрузку." : (e as Error).message;
      setPending((list) => list.map((x) => (x.localId === p.localId ? { ...x, status: "error", error: msg } : x)));
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - draft.photos.length - pending.length;
    const list = Array.from(files);
    if (list.length > room) setErrors((e) => ({ ...e, photos: `Можно приложить не больше ${MAX_PHOTOS} фото.` }));
    for (const f of list.slice(0, Math.max(0, room))) {
      if (!ACCEPT.includes(f.type)) {
        setErrors((e) => ({ ...e, photos: "Подходят только JPEG, PNG и WebP." }));
        continue;
      }
      if (f.size > 12 * 1024 * 1024) {
        setErrors((e) => ({ ...e, photos: "Файл больше 12 МБ." }));
        continue;
      }
      const p: Pending = { localId: Math.random().toString(36).slice(2), file: f, preview: await makeThumb(f), status: "uploading" };
      setPending((l) => [...l, p]);
      upload(p);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removePhoto(ph: DraftPhoto) {
    draftStore.set((d) => ({ ...d, photos: d.photos.filter((x) => x.id !== ph.id) }));
    fetch(`/api/uploads/${ph.id}`, { method: "DELETE", headers: { "x-upload-secret": ph.secret } }).catch(() => {});
  }

  function localCheck(): Record<string, string> {
    const e: Record<string, string> = {};
    if (draft.name.trim().length < 2) e.name = "Укажите имя";
    const d = draft.phone.replace(/\D/g, "");
    if (d.length < 10 || d.length > 15) e.phone = "Проверьте номер телефона";
    if (draft.address.trim().length < 5) e.address = "Укажите адрес";
    if (draft.wishTime && !draft.wishDate) e.wishDate = "Для времени нужна дата";
    if (draft.wishDate && draft.wishDate < today()) e.wishDate = "Дата уже прошла";
    if (draft.wishDate && draft.wishDate > maxDate()) e.wishDate = "Не дальше чем через полгода";
    if (needsPhoto && draft.photos.length === 0) e.photos = "Для «Другое» приложите хотя бы одно фото";
    if (pending.some((p) => p.status === "uploading")) e.photos = "Дождитесь загрузки фото";
    if (!draft.consent) e.consent = "Нужно согласие на обработку данных";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (sending) return;
    setFormError(null);
    const e = localCheck();
    setErrors(e);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }
    setSending(true);
    try {
      const body = {
        idempotencyKey: draft.idempotencyKey,
        items: items.map(({ category, variant, qty, heavy, secondSide, description }) => ({ category, variant, qty, heavy, secondSide, description: description || undefined })),
        name: draft.name,
        phone: draft.phone,
        address: draft.address,
        outOfTown: draft.outOfTown,
        wishDate: draft.wishDate || null,
        wishTime: draft.wishTime || null,
        comment: draft.comment,
        consent: draft.consent,
        photos: draft.photos.map(({ id, secret }) => ({ id, secret })),
      };
      const r = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFormError(j.error || "Заявка не отправилась. Попробуйте ещё раз.");
        if (j.fieldErrors) {
          const fe: Record<string, string> = {};
          for (const [k, v] of Object.entries(j.fieldErrors as Record<string, string>)) fe[k.startsWith("items") ? "items" : k.split(".")[0]] = v;
          setErrors(fe);
          if (fe.photos && /устарело/.test(fe.photos)) draftStore.set((d) => ({ ...d, photos: [] }));
        }
        return;
      }
      // успех показываем только после ответа сервера о записи в базу
      clearAfterOrder(j.token, j.number);
      router.push(`/o/${j.token}?new=1`);
    } catch {
      setFormError("Нет связи с сервером. Всё введённое сохранено — нажмите «Отправить заявку» ещё раз, дубля не будет.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (formError) document.getElementById("form-error")?.focus();
  }, [formError]);

  if (!hydrated) return <div className="card" style={{ minHeight: 300 }} aria-busy="true" />;
  if (items.length === 0)
    return (
      <div className="card">
        <EmptyCart onPick={() => router.push("/")} />
      </div>
    );

  const err = (k: string) =>
    errors[k] ? (
      <span className="err" id={`${k}-err`}>
        {errors[k]}
      </span>
    ) : null;
  const totalPhotos = draft.photos.length + pending.length;

  return (
    <form className="grid-2" onSubmit={submit} noValidate>
      <div className="stack">
        <div className="card stack">
          <h2 style={{ margin: 0, fontSize: 19 }}>Контакты и адрес</h2>
          <div className="field">
            <label htmlFor="f-name">Имя</label>
            <input id="f-name" data-field="name" className="input" autoComplete="name" value={draft.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} aria-describedby="name-err" maxLength={80} />
            {err("name")}
          </div>
          <div className="field">
            <label htmlFor="f-phone">Телефон</label>
            <input id="f-phone" data-field="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 7__ ___ __ __" value={draft.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} aria-describedby="phone-err" maxLength={30} />
            {err("phone")}
          </div>
          <div className="field">
            <label htmlFor="f-addr">Адрес</label>
            <input id="f-addr" data-field="address" className="input" autoComplete="street-address" placeholder="Улица, дом, квартира" value={draft.address} onChange={(e) => set("address", e.target.value)} aria-invalid={!!errors.address} aria-describedby="address-err" maxLength={300} />
            {err("address")}
          </div>
          <div className="toggle-row" style={{ borderTop: 0 }}>
            <div>
              <div className="label">Выезд за город</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Фиксированная доплата — учтена в сумме справа
              </div>
            </div>
            <Switch checked={draft.outOfTown} onChange={(v) => set("outOfTown", v)} label="Выезд за город" />
          </div>
        </div>

        <div className="card stack">
          <div>
            <h2 style={{ margin: 0, fontSize: 19 }}>Когда удобно</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              Необязательно. Это пожелание — мастер подтвердит запись после разговора.
            </p>
          </div>
          <div className="row-2">
            <div className="field">
              <label htmlFor="f-date">Дата</label>
              <input id="f-date" data-field="wishDate" className="input" type="date" min={today()} max={maxDate()} value={draft.wishDate} onChange={(e) => set("wishDate", e.target.value)} aria-invalid={!!errors.wishDate} aria-describedby="wishDate-err" />
              {err("wishDate")}
            </div>
            <div className="field">
              <label htmlFor="f-time">Время</label>
              <input id="f-time" data-field="wishTime" className="input" type="time" min="08:00" max="21:00" step={900} value={draft.wishTime} onChange={(e) => set("wishTime", e.target.value)} aria-invalid={!!errors.wishTime} />
              {err("wishTime")}
              {draft.wishTime && !draft.wishDate && !errors.wishDate && <span className="hint">Для конкретного времени выберите дату</span>}
            </div>
          </div>
        </div>

        <div className="card stack">
          <div>
            <h2 style={{ margin: 0, fontSize: 19 }}>Фото {needsPhoto ? "" : "(по желанию)"}</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
              {needsPhoto ? "Для «Другое» нужно хотя бы одно фото — по нему мастер назовёт цену." : "Пятна крупным планом помогут точнее оценить работу."} До {MAX_PHOTOS} фото, JPEG, PNG или WebP.
            </p>
          </div>
          <div className="photos" aria-live="polite">
            {draft.photos.map((p, i) => (
              <div className="photo" key={p.id}>
                {p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.preview} alt={`Фото ${i + 1}`} />
                ) : null}
                <button type="button" className="ph-del" aria-label={`Удалить фото ${i + 1}`} onClick={() => removePhoto(p)}>
                  ×
                </button>
                <div className="ph-state">Загружено</div>
              </div>
            ))}
            {pending.map((p) => (
              <div className="photo" key={p.localId}>
                {p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.preview} alt="" style={{ opacity: 0.6 }} />
                ) : null}
                <button type="button" className="ph-del" aria-label="Убрать фото" onClick={() => setPending((l) => l.filter((x) => x.localId !== p.localId))}>
                  ×
                </button>
                <div className="ph-state">
                  {p.status === "uploading" ? (
                    "Загрузка…"
                  ) : (
                    <>
                      <span title={p.error}>Ошибка</span>
                      <button type="button" className="btn btn-sm" style={{ minHeight: 28, padding: "0 8px", background: "#fff", color: "#111" }} onClick={() => upload(p)}>
                        Повторить
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {totalPhotos < MAX_PHOTOS && (
              <button type="button" className="photo-add" data-field="photos" onClick={() => fileInput.current?.click()}>
                + Добавить фото
              </button>
            )}
          </div>
          {pending.find((p) => p.error) && <span className="err">{pending.find((p) => p.error)!.error}</span>}
          {err("photos")}
          <input ref={fileInput} type="file" accept={ACCEPT.join(",")} multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>

        <div className="card stack">
          <div className="field">
            <label htmlFor="f-comment">Комментарий</label>
            <textarea id="f-comment" className="textarea" placeholder="Этаж, домофон, особенности ткани, питомцы" value={draft.comment} onChange={(e) => set("comment", e.target.value)} maxLength={1000} />
          </div>
          <label className="check">
            <input type="checkbox" data-field="consent" checked={draft.consent} onChange={(e) => set("consent", e.target.checked)} aria-invalid={!!errors.consent} aria-describedby="consent-err" />
            <span>
              Согласен на обработку персональных данных для связи по заявке.{" "}
              <Link href={privacyHref} target="_blank">
                Политика
              </Link>
            </span>
          </label>
          {err("consent")}
        </div>
      </div>

      <div className="stack" style={{ position: "sticky", top: 76 }}>
        <div className="card">
          <h2 style={{ margin: "0 0 4px", fontSize: 19 }}>Состав заявки</h2>
          {items.map((i) => (
            <CartLine key={i.uid} item={i} pricing={pricing} onRemove={remove} />
          ))}
          {err("items")}
          <div style={{ paddingTop: 12 }}>
            <Totals items={items} pricing={pricing} outOfTown={draft.outOfTown} />
          </div>
          <Link href="/" className="link-btn" style={{ display: "inline-block", marginTop: 6 }}>
            Вернуться к выбору
          </Link>
        </div>
        {formError && (
          <div className="alert" id="form-error" tabIndex={-1} role="alert">
            {formError}
          </div>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={sending}>
          {sending ? "Отправляем…" : "Отправить заявку"}
        </button>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Оплата не нужна. Мастер перезвонит, согласует цену и время.
        </p>
      </div>
      <UndoToast undo={undo} restore={restore} />
    </form>
  );
}
