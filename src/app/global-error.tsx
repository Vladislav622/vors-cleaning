"use client";
// Срабатывает, если не загрузился даже общий макет (например, база недоступна)
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#eef1ef", color: "#17201d", padding: 24 }}>
        <div style={{ maxWidth: 520, margin: "10vh auto" }}>
          <h1 style={{ fontSize: 28 }}>Сервис временно недоступен</h1>
          <p>Мы уже чиним. Корзина и черновик заявки сохранены в этом браузере — вернитесь через несколько минут.</p>
          <button onClick={reset} style={{ padding: "12px 20px", borderRadius: 14, border: 0, background: "#2f6f62", color: "#fff", fontWeight: 700, fontSize: 16 }}>Обновить</button>
        </div>
      </body>
    </html>
  );
}
