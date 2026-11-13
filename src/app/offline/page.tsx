export const metadata = { title: "Нет соединения" };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="page wrap" style={{ maxWidth: 560, textAlign: "center" }}>
      <h1>Нет соединения</h1>
      <p className="muted">Корзина и черновик заявки сохранены в этом браузере. Когда интернет вернётся, обновите страницу и продолжите.</p>
    </div>
  );
}
