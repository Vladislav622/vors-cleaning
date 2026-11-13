"use client";
import { useState } from "react";
import { api, ApiError } from "./api";

export default function AccessForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next !== repeat) return setErrors({ repeat: "Пароли не совпадают" });
    if (next.length < 10) return setErrors({ next: "От 10 символов" });
    setBusy(true);
    setErrors({});
    try {
      await api("/api/admin/password", { method: "POST", json: { current, next } });
      setCurrent("");
      setNext("");
      setRepeat("");
      setMsg({ ok: true, text: "Пароль изменён. Все другие сеансы закрыты." });
    } catch (err) {
      const ae = err as ApiError;
      setErrors(ae.fieldErrors ?? {});
      setMsg({ ok: false, text: ae.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h1 style={{ margin: "4px 0", fontSize: 26 }}>Доступ</h1>
      <form className="card stack" onSubmit={change}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Сменить пароль</h2>
        <div className="field">
          <label htmlFor="cur">Текущий пароль</label>
          <input id="cur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={!!errors.current} />
          {errors.current && <span className="err">{errors.current}</span>}
        </div>
        <div className="field">
          <label htmlFor="nx">Новый пароль</label>
          <input id="nx" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!errors.next} />
          {errors.next ? <span className="err">{errors.next}</span> : <span className="hint">От 10 символов. После смены прежние сеансы на других устройствах закроются.</span>}
        </div>
        <div className="field">
          <label htmlFor="rp">Повторите новый пароль</label>
          <input id="rp" className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={!!errors.repeat} />
          {errors.repeat && <span className="err">{errors.repeat}</span>}
        </div>
        {msg && <div className={msg.ok ? "saved" : "alert"} role="status">{msg.text}</div>}
        <button className="btn btn-primary" disabled={busy || !current || !next}>{busy ? "Сохраняем…" : "Сменить пароль"}</button>
      </form>
      <div className="card stack">
        <h2 style={{ margin: 0, fontSize: 17 }}>Выход</h2>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
            location.href = "/admin/login";
          }}
        >
          Выйти из кабинета
        </button>
      </div>
    </div>
  );
}
