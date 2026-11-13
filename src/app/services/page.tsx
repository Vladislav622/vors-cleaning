import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";
import { formatMoney } from "@/lib/pricing";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Услуги и цены", description: "Цены на выездную химчистку диванов, кресел, матрасов и стульев." };

export default async function Services() {
  const { pricing: p } = await getSettings();
  const m = (v: number) => formatMoney(v, p.currency);
  return (
    <div className="page wrap">
      <h1>Услуги и цены</h1>
      <p className="muted" style={{ maxWidth: "62ch" }}>
        Приезжаем со своим оборудованием и средствами, чистим на месте. Цены — от базовой стоимости; итог мастер согласует после разговора и, при необходимости, фото.
      </p>
      <div className="services" style={{ marginTop: 16 }}>
        {CATEGORIES.map((c) => (
          <section key={c.id} className="card service">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/posters/${c.model}.webp`} alt="" loading="lazy" width={900} height={700} />
            <h2>{c.plural}</h2>
            {c.variants.length ? (
              <ul>
                {c.variants.map((v) => (
                  <li key={v.id}>
                    <span>{v.label}</span>
                    <strong className="num">{m(p.variants[v.id])}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <ul>
                <li>
                  <span>Пуфы, банкетки, изголовья, авто-сиденья</span>
                  <strong>по фото</strong>
                </li>
              </ul>
            )}
            <Link className="btn btn-ghost btn-block" href={`/?c=${c.id}`}>
              Выбрать {c.label.toLowerCase()}
            </Link>
          </section>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 19 }}>Как считается цена</h2>
        <ul style={{ paddingLeft: 18, margin: 0, display: "grid", gap: 6 }}>
          <li>Вторая сторона матраса: +{p.secondSidePct}% к цене матраса.</li>
          <li>Сильные загрязнения (пятна, запахи, шерсть): +{p.heavySoilingPct}% к позиции.</li>
          <li>Цена за штуку округляется вверх до {m(p.roundingStep)}.</li>
          <li>Минимальный заказ на чистку — {m(p.minOrder)}.</li>
          <li>Выезд за город — {m(p.outOfTownFee)} сверху, не входит в минимум.</li>
          <li>«Другое» оцениваем по фото.</li>
        </ul>
      </div>
    </div>
  );
}
