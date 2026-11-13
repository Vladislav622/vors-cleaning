"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/admin", "Заявки"],
  ["/admin/prices", "Тарифы"],
  ["/admin/company", "Компания"],
  ["/admin/game", "Игра"],
  ["/admin/characters", "Персонажи"],
  ["/admin/access", "Доступ"],
] as const;

export default function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Разделы кабинета">
      {TABS.map(([href, label]) => {
        const active = href === "/admin" ? path === "/admin" || path.startsWith("/admin/orders") : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
