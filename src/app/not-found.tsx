import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page wrap" style={{ maxWidth: 560 }}>
      <h1>Страница не найдена</h1>
      <p className="muted">Проверьте адрес. Если это ссылка на заявку — скопируйте её целиком из сообщения.</p>
      <Link className="btn btn-primary" href="/">На главную</Link>
    </div>
  );
}
