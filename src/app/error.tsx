"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page wrap" style={{ maxWidth: 560 }}>
      <h1>Что-то пошло не так</h1>
      <p className="muted">Страница не загрузилась. Корзина и черновик заявки сохранены в браузере.</p>
      <button className="btn btn-primary" type="button" onClick={reset}>Попробовать снова</button>
    </div>
  );
}
