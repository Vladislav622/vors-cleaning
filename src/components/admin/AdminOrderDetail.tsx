"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { itemTitle } from "@/lib/catalog";
import { STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-schema";
import { describeItem, formatMoney } from "@/lib/pricing";
import type { AdminOrder } from "@/lib/server/admin-orders";
import { eventLabel } from "./events";
import { api, ApiError } from "./api";

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function AdminOrderDetail({ initial }: { initial: AdminOrder; tz: string }) {
  const router = useRouter();
  const [o, setO] = useState(initial);
  const [status, setStatus] = useState<OrderStatus>(o.status);
  const [price, setPrice] = useState(o.final_price?.toString() ?? "");
  const [visit, setVisit] = useState(toLocalInput(o.agreed_visit_at));
  const [note, setNote] = useState(o.owner_note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delInput, setDelInput] = useState("");
  const cur = o.pricing_snapshot.currency;
  const m = (v: number) => formatMoney(v, cur);
  const e = o.estimate;
  const phoneDigits = o.phone.replace(/\D/g, "");

  const save = async (patch?: Partial<{ status: OrderStatus }>) => {
    setBusy(true);
    setMsg(null);
    setErrors({});
    const p = price.trim() === "" ? null : Number(price.replace(/\s/g, ""));
    if (p != null && (!Number.isInteger(p) || p < 0)) {
      setErrors({ finalPrice: "Целое число без копеек" });
      setBusy(false);
      return;
    }
    try {
      const next = await api<AdminOrder>(`/api/admin/orders/${o.id}`, {
        method: "PATCH",
        json: { status: patch?.status ?? status, finalPrice: p, agreedVisitAt: visit ? new Date(visit).toISOString() : null, ownerNote: note },
      });
      setO(next);
      setStatus(next.status);
      setMsg({ ok: true, text: "Сохранено. Клиент увидит изменения по своей ссылке." });
    } catch (err) {
      const ae = err as ApiError;
      setErrors(ae.fieldErrors ?? {});
      setMsg({ ok: false, text: ae.message });
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    if (!o.bonus) return;
    try {
      await api(`/api/admin/bonus/${o.bonus.id}`, { method: "POST" });
      setO({ ...o, bonus: { ...o.bonus, redeemed_at: new Date().toISOString() } });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  const del = async () => {
    try {
      await api(`/api/admin/orders/${o.id}?confirm=${encodeURIComponent(delInput)}`, { method: "DELETE" });
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/admin" className="link-btn">Все заявки</Link>
        <h1 style={{ margin: 0, fontSize: 26 }}>Заявка № {o.number}</h1>
        <span className="status-pill" data-active="true" data-status={o.status}>{STATUS_LABEL[o.status]}</span>
      </div>

      <div className="grid-2">
        <div className="stack">
          <div className="card stack">
            <h2 style={{ margin: 0, fontSize: 18 }}>Клиент</h2>
            <dl className="kv">
              <dt>Имя</dt><dd>{o.customer_name}</dd>
              <dt>Телефон</dt><dd className="num">{o.phone}</dd>
              <dt>Адрес</dt><dd>{o.address}{o.out_of_town ? " (за городом)" : ""}</dd>
              <dt>Пожелание</dt>
              <dd>{o.wish_date ? new Date(o.wish_date + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" }) : "дата не указана"}{o.wish_time ? `, ${o.wish_time}` : ""}</dd>
              {o.comment && (<><dt>Комментарий</dt><dd style={{ whiteSpace: "pre-wrap" }}>{o.comment}</dd></>)}
              <dt>Создана</dt><dd>{new Date(o.created_at).toLocaleString("ru-RU")}</dd>
            </dl>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn btn-primary btn-sm" href={`tel:${o.phone}`}>Позвонить</a>
              <a className="btn btn-ghost btn-sm" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(`${location.origin}/o/${o.public_token}`)}>Скопировать ссылку клиента</button>
            </div>
          </div>

          <div className="card">
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Состав и предварительный расчёт</h2>
            {o.items.map((l, i) => (
              <div className="cart-item" key={i}>
                <div className="cart-item-top">
                  <div>
                    <h3>{itemTitle(l.category, l.variant)}{l.qty > 1 ? ` × ${l.qty}` : ""}</h3>
                    <div className="sub">{l.manual ? l.description : describeItem(l)}{l.unitPrice != null ? `. ${m(l.unitPrice)} за шт.` : ""}</div>
                  </div>
                  {l.lineTotal == null ? <span className="manual-tag">по фото</span> : <strong className="num">{m(l.lineTotal)}</strong>}
                </div>
              </div>
            ))}
            <div className="totals num" style={{ paddingTop: 10 }}>
              <div className="row"><span>Известные позиции</span><span>{m(e.knownSubtotal)}</span></div>
              {e.minTopUp > 0 && <div className="row muted"><span>Доплата до минимума ({m(e.minOrder)})</span><span>{m(e.minTopUp)}</span></div>}
              {e.travelFee > 0 && <div className="row"><span>Выезд за город</span><span>{m(e.travelFee)}</span></div>}
              {e.manualCount > 0 && <div className="row"><span>По фото</span><span>{e.manualCount} поз.</span></div>}
              <div className="row total"><span>{e.exact ? "Итого предварительно" : "Предварительно, от"}</span><span>{e.manualOnly ? "по фото" : m(e.totalFrom)}</span></div>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Снимок прайса на момент отправки: мин. заказ {m(o.pricing_snapshot.minOrder)}, загрязнения +{o.pricing_snapshot.heavySoilingPct}%, вторая сторона +{o.pricing_snapshot.secondSidePct}%, выезд {m(o.pricing_snapshot.outOfTownFee)}.</p>
          </div>

          <div className="card stack">
            <h2 style={{ margin: 0, fontSize: 18 }}>Фото ({o.photos.length})</h2>
            {o.photos.length ? (
              <div className="admin-photos">
                {o.photos.map((p, i) => (
                  <a key={p.id} href={`/api/admin/photos/${p.id}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/photos/${p.id}`} alt={`Фото ${i + 1} к заявке`} loading="lazy" />
                  </a>
                ))}
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>Клиент не приложил фото.</p>}
          </div>
        </div>

        <div className="stack">
          <form className="card stack" onSubmit={(ev) => { ev.preventDefault(); save(); }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Согласование</h2>
            <div className="field">
              <label htmlFor="st">Статус</label>
              <select id="st" className="select" value={status} onChange={(ev) => setStatus(ev.target.value as OrderStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <span className="hint">Для «Согласована» и «Завершена» нужны цена и время.</span>
            </div>
            <div className="field">
              <label htmlFor="fp">Итоговая цена, {cur}</label>
              <input id="fp" className="input num" inputMode="numeric" value={price} onChange={(ev) => setPrice(ev.target.value)} aria-invalid={!!errors.finalPrice} />
              {errors.finalPrice && <span className="err">{errors.finalPrice}</span>}
            </div>
            <div className="field">
              <label htmlFor="vt">Согласованное время выезда</label>
              <input id="vt" className="input" type="datetime-local" value={visit} onChange={(ev) => setVisit(ev.target.value)} aria-invalid={!!errors.agreedVisitAt} />
              {errors.agreedVisitAt && <span className="err">{errors.agreedVisitAt}</span>}
            </div>
            <div className="field">
              <label htmlFor="nt">Приватная заметка</label>
              <textarea id="nt" className="textarea" value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={4000} />
              <span className="hint">Видите только вы. Клиенту не показывается.</span>
            </div>
            {msg && <div className={msg.ok ? "saved" : "alert"} role="status">{msg.text}</div>}
            <button className="btn btn-primary" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
          </form>

          {o.bonus && (
            <div className="card stack">
              <h2 style={{ margin: 0, fontSize: 18 }}>Бонус из игры</h2>
              <div className="code-box" style={{ fontSize: 18 }}>{o.bonus.code}</div>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>{m(o.bonus.amount)} на следующий заказ от {m(o.bonus.min_order)}, до {new Date(o.bonus.expires_at).toLocaleDateString("ru-RU")}. Применяется вручную; проверка честности игры не проводится.</p>
              {o.bonus.redeemed_at ? <span className="saved">Использован {new Date(o.bonus.redeemed_at).toLocaleDateString("ru-RU")}</span> : <button className="btn btn-ghost btn-sm" type="button" onClick={redeem}>Отметить использованным</button>}
            </div>
          )}

          <div className="card stack">
            <h2 style={{ margin: 0, fontSize: 18 }}>История</h2>
            <ul className="history">
              {o.events.map((ev) => (
                <li key={ev.id}><time>{new Date(ev.created_at).toLocaleString("ru-RU")}</time>{eventLabel(ev.kind, ev.payload, cur)}</li>
              ))}
            </ul>
          </div>

          <div className="card stack">
            {!confirmDel ? (
              <button className="btn btn-danger" type="button" onClick={() => setConfirmDel(true)}>Удалить заявку и фото</button>
            ) : (
              <>
                <p style={{ margin: 0 }}>Заявка, фото и история удалятся без возможности восстановления. Введите номер заявки <strong>{o.number}</strong> для подтверждения.</p>
                <input className="input" inputMode="numeric" value={delInput} onChange={(ev) => setDelInput(ev.target.value)} aria-label="Номер заявки для подтверждения" />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-danger" type="button" disabled={delInput !== String(o.number)} onClick={del}>Удалить навсегда</button>
                  <button className="btn btn-ghost" type="button" onClick={() => { setConfirmDel(false); setDelInput(""); }}>Отмена</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
