import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { itemTitle, modelFor } from "@/lib/catalog";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-schema";
import { describeItem, formatMoney } from "@/lib/pricing";
import { getPublicOrder } from "@/lib/server/orders";
import { getSettings } from "@/lib/server/settings";
import { ContactButtons } from "@/components/ContactButtons";
import { OrderLive, GameSection, CopyLinkCard } from "@/components/OrderClient";

export const metadata: Metadata = { title: "Ваша заявка", robots: { index: false, follow: false } };

const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("ru-RU", { day: "numeric", month: "long", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: process.env.APP_TZ || "Asia/Almaty" });

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params;
  const { new: isNew } = await searchParams;
  const [o, s] = await Promise.all([getPublicOrder(token), getSettings()]);
  if (!o) notFound();
  const m = (v: number) => formatMoney(v, o.currency);
  const e = o.estimate;
  const steps: OrderStatus[] = o.status === "cancelled" ? ["new", "cancelled"] : ["new", "agreed", "done"];
  const firstKnown = o.items.find((i) => !i.manual);
  const gameModel = firstKnown ? modelFor(firstKnown.category, firstKnown.variant) : "other";

  return (
    <div className="page wrap">
      <OrderLive />
      {isNew && (
        <div className="notice" role="status" style={{ marginBottom: 12 }}>
          Заявка сохранена. Мастер свяжется с вами, уточнит детали и время. Сохраните ссылку на эту страницу — здесь появятся цена и время выезда.
        </div>
      )}
      <h1>Заявка № {o.number}</h1>
      <div className="status-steps" aria-label="Статус заявки">
        {steps.map((st) => (
          <span key={st} className="status-pill" data-status={st} data-active={st === o.status} aria-current={st === o.status ? "step" : undefined}>
            {STATUS_LABEL[st]}
          </span>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="stack">
          <div className="card stack">
            <h2 style={{ margin: 0, fontSize: 19 }}>Цена и время</h2>
            {o.finalPrice != null || o.agreedVisitAt ? (
              <dl className="kv">
                {o.finalPrice != null && (
                  <>
                    <dt>Согласованная цена</dt>
                    <dd className="num" style={{ fontSize: 20 }}>
                      {m(o.finalPrice)}
                    </dd>
                  </>
                )}
                {o.agreedVisitAt && (
                  <>
                    <dt>Время выезда</dt>
                    <dd>{fmtDateTime(o.agreedVisitAt)}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {o.status === "cancelled" ? "Заявка отменена." : "Мастер ещё не согласовал цену и время. После звонка они появятся здесь."}
              </p>
            )}
            <dl className="kv">
              <dt>Предварительный расчёт</dt>
              <dd className="num">
                {e.manualOnly ? (e.travelFee ? `${m(e.travelFee)} за выезд + чистка по фото` : "по фото") : e.exact ? m(e.totalFrom) : `от ${m(e.totalFrom)} + позиции по фото`}
              </dd>
              {(o.wishDate || o.wishTime) && (
                <>
                  <dt>Ваше пожелание</dt>
                  <dd>
                    {o.wishDate ? fmtDate(o.wishDate) : ""}
                    {o.wishTime ? `, ${o.wishTime}` : ""}
                  </dd>
                </>
              )}
              <dt>Адрес</dt>
              <dd>
                {o.address}
                {o.outOfTown ? " (за городом)" : ""}
              </dd>
              {o.photoCount > 0 && (
                <>
                  <dt>Фото</dt>
                  <dd>Приложено: {o.photoCount}. Видит только мастер.</dd>
                </>
              )}
            </dl>
          </div>

          <div className="card">
            <h2 style={{ margin: "0 0 4px", fontSize: 19 }}>Состав</h2>
            {o.items.map((l, i) => (
              <div className="cart-item" key={i}>
                <div className="cart-item-top">
                  <div>
                    <h3>
                      {itemTitle(l.category, l.variant)}
                      {l.qty > 1 ? ` × ${l.qty}` : ""}
                    </h3>
                    <div className="sub">{l.manual ? l.description : describeItem(l)}</div>
                  </div>
                  {l.lineTotal == null ? <span className="manual-tag">по фото</span> : <strong className="num">{m(l.lineTotal)}</strong>}
                </div>
              </div>
            ))}
            <div className="totals num" style={{ paddingTop: 12 }}>
              {e.minTopUp > 0 && (
                <div className="row muted">
                  <span>Доплата до минимума</span>
                  <span>{m(e.minTopUp)}</span>
                </div>
              )}
              {e.travelFee > 0 && (
                <div className="row">
                  <span>Выезд за город</span>
                  <span>{m(e.travelFee)}</span>
                </div>
              )}
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Расчёт сохранён по ценам на момент отправки и не меняется при обновлении прайса.
            </p>
          </div>
        </div>

        <div className="stack">
          <CopyLinkCard />
          <div className="card stack">
            <h2 style={{ margin: 0, fontSize: 19 }}>Связаться</h2>
            <ContactButtons company={s.company} fallback="Мастер позвонит на номер из заявки." />
          </div>
          {s.game.mode !== "off" && o.status !== "cancelled" && (
            <GameSection token={token} model={gameModel} mode={s.game.mode} bonus={o.bonus} currency={o.currency} game={s.game} showFaces={s.characters.showFaces} />
          )}
          <Link href="/" className="btn btn-ghost">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
