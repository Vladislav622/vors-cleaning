import type { Metadata } from "next";
import Link from "next/link";
import { ContactButtons } from "@/components/ContactButtons";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Контакты" };

export default async function Contacts() {
  const { company: c } = await getSettings();
  return (
    <div className="page wrap" style={{ maxWidth: 760 }}>
      <h1>Контакты</h1>
      <div className="card stack">
        <ContactButtons company={c} fallback="Контакты компании ещё не указаны. Оставьте заявку на сайте — мастер позвонит на ваш номер." />
        <dl className="kv">
          {c.city && (<><dt>Город</dt><dd>{c.city}</dd></>)}
          {c.territory && (<><dt>Где работаем</dt><dd>{c.territory}</dd></>)}
          {c.workHours && (<><dt>Часы работы</dt><dd>{c.workHours}</dd></>)}
          {c.legalName && (<><dt>Исполнитель</dt><dd>{c.legalName}</dd></>)}
        </dl>
        <Link className="btn btn-primary" href="/">Оставить заявку</Link>
      </div>
    </div>
  );
}
