import type { Metadata } from "next";

export const metadata: Metadata = { title: "Модели и лицензии" };

export default function Credits() {
  return (
    <div className="page wrap" style={{ maxWidth: 760 }}>
      <h1>Модели и лицензии</h1>
      <div className="card stack" style={{ lineHeight: 1.6 }}>
        <p>3D-модели мебели (диваны, кресла, матрас, стулья, пуф) и их персонажи созданы специально для этого проекта процедурно в Blender — скриптом, который входит в исходники. Права на них передаются вместе с исходным кодом; сторонние модели не используются.</p>
        <p>Шрифт Manrope — SIL Open Font License 1.1. Библиотеки: Next.js, React (MIT), three.js, React Three Fiber, Drei (MIT), Motion (MIT), node-postgres (MIT), sharp (Apache-2.0), Zod (MIT).</p>
        <p>Полный список с версиями — в файле LICENSES.md в исходниках.</p>
      </div>
    </div>
  );
}
