import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getSettings } from "@/lib/server/settings";
import { CartButton, ThemeToggle, SwRegister } from "@/components/HeaderClient";
import CartSheet from "@/components/CartSheet";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const c = s.company;
  const title = `${c.name} — ${c.tagline || "химчистка мягкой мебели"}${c.city ? `, ${c.city}` : ""}`;
  const description = `Выездная химчистка диванов, кресел, матрасов и стульев${c.city ? ` в городе ${c.city}` : ""}. Выберите мебель, узнайте примерную стоимость и оставьте заявку — мастер перезвонит и согласует время.`;
  const base = process.env.APP_URL ? new URL(process.env.APP_URL) : undefined;
  return {
    metadataBase: base,
    title: { default: title, template: `%s — ${c.name}` },
    description,
    applicationName: c.name,
    openGraph: { title, description, type: "website", locale: "ru_RU", images: ["/og.png"] },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: c.name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1513" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('vors.theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const c = s.company;
  return (
    <html lang="ru" suppressHydrationWarning style={{ ["--accent-base" as string]: c.accent }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip" href="#main">К содержимому</a>
        {c.demo && <div className="demo-banner">Демо-версия: компания и контакты вымышленные, заявки уходят в тестовую базу.</div>}
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="logo" aria-label={`${c.name} — на главную`}>
              <span className="logo-mark" aria-hidden />
              {c.name}
            </Link>
            <nav className="nav" aria-label="Основное меню">
              <Link className="navlink hide-sm" href="/services">Услуги и цены</Link>
              <Link className="navlink hide-sm" href="/contacts">Контакты</Link>
              <ThemeToggle />
              <CartButton />
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <div>
              <strong style={{ color: "var(--ink)" }}>{c.name}</strong>
              {c.tagline ? ` — ${c.tagline.toLowerCase()}` : ""}
              {c.city ? `. ${c.city}` : ""}
              {c.territory ? `, ${c.territory.charAt(0).toLowerCase() + c.territory.slice(1)}` : ""}.
            </div>
            <div className="foot-links">
              <Link href="/services">Услуги и цены</Link>
              <Link href="/contacts">Контакты</Link>
              <Link href="/privacy">Политика обработки данных</Link>
              <Link href="/credits">Модели и лицензии</Link>
              <Link href="/admin">Кабинет</Link>
            </div>
            <div>Цены на сайте предварительные. Итоговую стоимость и время мастер согласует после разговора. Онлайн-оплаты нет.</div>
          </div>
        </footer>
        <CartSheet pricing={s.pricing} />
        <SwRegister />
      </body>
    </html>
  );
}
