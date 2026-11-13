import { STATUS_LABEL, type OrderStatus } from "@/lib/order-schema";
import { formatMoney } from "@/lib/pricing";

export function eventLabel(kind: string, p: Record<string, unknown>, currency: string): string {
  switch (kind) {
    case "created":
      return `Клиент отправил заявку: позиций ${p.items}, фото ${p.photos}`;
    case "status":
      return `Статус: ${STATUS_LABEL[p.from as OrderStatus] ?? p.from} → ${STATUS_LABEL[p.to as OrderStatus] ?? p.to}`;
    case "price":
      return p.to == null ? "Итоговая цена убрана" : `Итоговая цена: ${formatMoney(Number(p.to), currency)}`;
    case "visit":
      return p.to == null ? "Время выезда убрано" : `Время выезда: ${new Date(String(p.to)).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`;
    case "note":
      return "Заметка обновлена";
    case "bonus":
      return `Клиент получил бонус-код ${p.code}`;
    case "bonus_redeemed":
      return "Бонус-код отмечен использованным";
    default:
      return kind;
  }
}
