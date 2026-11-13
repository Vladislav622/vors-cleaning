"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { itemTitle, type CategoryId, type VariantId } from "@/lib/catalog";
import { STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-schema";
import { formatMoney } from "@/lib/pricing";
import { api } from "./api";

type Row = {
  id: string; number: number; status: OrderStatus; customer_name: string; phone: string; address: string; created_at: string;
  final_price: number | null; agreed_visit_at: string | null; currency: string; photo_count: number; out_of_town: boolean;
  estimate: { totalFrom: number; exact: boolean; manualOnly: boolean };
  items: { category: CategoryId; variant: VariantId | null; qty: number }[];
};

export default function AdminOrders() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api<{ orders: Row[] }>(`/api/admin/orders?q=${encodeURIComponent(q)}&status=${status}`);
      setRows(r.orders);
      setUpdatedAt(new Date());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const est = (r: Row) => {
    const m = (v: number) => formatMoney(v, r.currency);
    if (r.final_price != null) return <strong>{m(r.final_price)}</strong>;
    if (r.estimate.manualOnly) return <span className="manual-tag">по фото</span>;
    return <span className="muted">{r.estimate.exact ? "≈ " : "от "}{m(r.estimate.totalFrom)}</span>;
  };

  return (
    <div>
      <div className="toolbar">
        <input className="input" type="search" placeholder="Имя, телефон, адрес или №" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск заявок" />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Фильтр по статусу">
          <option value="">Все статусы</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>{loading ? "Обновляем…" : "Обновить"}</button>
        {updatedAt && <span className="muted" style={{ fontSize: 13 }}>Обновлено в {updatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      {err && <div className="alert" role="alert">{err}</div>}
      {rows && rows.length === 0 && (
        <div className="card empty"><strong>{q || status ? "Ничего не нашлось" : "Заявок пока нет"}</strong><span className="muted">{q || status ? "Измените поиск или фильтр." : "Новые заявки с сайта появятся здесь."}</span></div>
      )}
      {rows && rows.length > 0 && (
        <table className="orders-table">
          <thead><tr><th>№</th><th>Клиент</th><th>Состав</th><th>Сумма</th><th>Статус</th><th>Создана</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/orders/${r.id}`}>№ {r.number}</Link></td>
                <td><Link href={`/admin/orders/${r.id}`}>{r.customer_name}</Link><div className="muted num" style={{ fontSize: 13 }}>{r.phone}</div></td>
                <td style={{ fontSize: 13.5 }}>{r.items.map((i) => itemTitle(i.category, i.variant) + (i.qty > 1 ? ` ×${i.qty}` : "")).join("; ")}{r.photo_count ? <span className="muted">; фото: {r.photo_count}</span> : null}</td>
                <td className="num">{est(r)}</td>
                <td><span className="status-pill" data-active={r.status !== "done"} data-status={r.status}>{STATUS_LABEL[r.status]}</span></td>
                <td className="muted" style={{ fontSize: 13 }}>{new Date(r.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!rows && !err && <div className="card" aria-busy="true" style={{ minHeight: 120 }} />}
    </div>
  );
}
