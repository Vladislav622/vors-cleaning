"use client";
import { useState } from "react";
import { api, ApiError } from "./api";

export default function LoginForm() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new ApiError(j.error || "Не удалось войти.", r.status);
          location.href = "/admin";
        } catch (e) {
          setErr(e instanceof ApiError ? e.message : "Нет связи с сервером.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="pw">Пароль</label>
        <input id="pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err} aria-describedby="pw-err" autoFocus />
        {err && <span className="err" id="pw-err">{err}</span>}
      </div>
      <button className="btn btn-primary" disabled={busy || !pw}>{busy ? "Входим…" : "Войти"}</button>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Первый вход — паролем из переменной ADMIN_PASSWORD. Потом смените его в разделе «Доступ».</p>
    </form>
  );
}
