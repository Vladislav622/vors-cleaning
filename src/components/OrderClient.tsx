"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatMoney } from "@/lib/pricing";
import type { GameSettings } from "@/lib/settings-schema";

const CleanGame = dynamic(() => import("./game/CleanGame"), { ssr: false, loading: () => <div className="game-stage" aria-busy="true" /> });

/** Подтягивает изменения владельца: при возвращении на вкладку и раз в минуту */
export function OrderLive() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", refresh);
    const id = setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(id);
    };
  }, [router]);
  return null;
}

export function CopyLinkCard() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    const u = new URL(location.href);
    u.search = "";
    setUrl(u.toString());
    if (location.search.includes("new=1")) history.replaceState(null, "", u.pathname);
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement("textarea");
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="card stack">
      <h2 style={{ margin: 0, fontSize: 19 }}>Ссылка на заявку</h2>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Ссылка личная: по ней видны состав и статус. Не публикуйте её. Изменения от мастера появятся здесь.
      </p>
      <input className="input" readOnly value={url} aria-label="Ссылка на заявку" onFocus={(e) => e.target.select()} style={{ fontSize: 13 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} type="button" onClick={copy}>
          {copied ? "Скопировано" : "Скопировать"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => start(() => router.refresh())} disabled={pending}>
          {pending ? "Обновляем…" : "Обновить"}
        </button>
      </div>
    </div>
  );
}

type Bonus = { code: string; amount: number; minOrder: number; expiresAt: string } | null;

export function GameSection(p: { token: string; model: string; mode: GameSettings["mode"]; bonus: Bonus; currency: string; game: GameSettings; showFaces: boolean }) {
  const [open, setOpen] = useState(false);
  const [bonus, setBonus] = useState<Bonus>(p.bonus);
  const [error, setError] = useState<string | null>(null);
  const m = (v: number) => formatMoney(v, p.currency);

  const onWin = async () => {
    if (p.mode !== "bonus" || bonus) return;
    try {
      const r = await fetch(`/api/orders/${p.token}/game`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.bonus) setBonus(j.bonus);
    } catch (e) {
      setError((e as Error).message || "Не получилось сохранить бонус. Попробуйте позже.");
    }
  };

  return (
    <div className="card stack">
      <h2 style={{ margin: 0, fontSize: 19 }}>Пока ждёте звонка</h2>
      {bonus ? (
        <div className="stack">
          <p style={{ margin: 0 }}>
            Ваш бонус на следующий заказ — {m(bonus.amount)}. Действует до {new Date(bonus.expiresAt).toLocaleDateString("ru-RU")} при заказе от {m(bonus.minOrder)}.
          </p>
          <div className="code-box">{bonus.code}</div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Назовите код мастеру при следующей заявке — он применит бонус вручную. На текущий заказ бонус не влияет.
          </p>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {p.mode === "bonus"
            ? `Почистите пятна на модели — получите бонус ${m(p.game.bonusAmount)} на следующий заказ от ${m(p.game.minNextOrder)}. Текущий заказ не дешевеет.`
            : "Короткая игра: сотрите пятна пальцем или мышью. Просто для удовольствия."}
        </p>
      )}
      {!open ? (
        <button className="btn btn-ghost" type="button" onClick={() => setOpen(true)}>
          {bonus ? "Сыграть ещё раз" : "Почистить пятна"}
        </button>
      ) : (
        <CleanGame model={p.model} onWin={onWin} showFaces={p.showFaces} onClose={() => setOpen(false)} />
      )}
      {error && <span className="err">{error}</span>}
    </div>
  );
}
