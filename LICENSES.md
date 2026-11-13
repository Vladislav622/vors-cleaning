# Лицензии и источники

## 3D-модели и арт

Все модели мебели (диваны 2/3 места и угловой, кресло обычное и реклайнер, матрас односпальный и двуспальный, стул с мягким сиденьем и со спинкой, пуф «Другое»), их лица и руки созданы с нуля для этого проекта скриптом `blender/generate_models.py` (Blender 5.3). Сторонние модели не использовались. Права передаются заказчику вместе с исходниками; можно свободно менять и использовать коммерчески.

- `assets-src/vors-furniture.blend` — сцена Blender со всеми вариантами.
- `assets-src/glb/` — экспорт из Blender; `public/models/` — оптимизированные (gltf-transform: weld + meshopt).
- `assets-src/posters/`, `public/posters/` — рендеры для режима без WebGL и страницы услуг.
- Иконки PWA и OG-картинка генерируются `scripts/make-icons.mjs`.

Рассматривалась библиотека Innerscene (условия: CC0, коммерческое использование и распространение разрешены, указание автора не требуется — https://www.innerscene.com/tools/library/terms). Модели оттуда не скачаны: сайт закрыт проверкой Cloudflare. Если захотите заменить модели на CC0-модели Innerscene, сохраните ссылку на страницу модели в этом файле.

## Шрифт

Manrope (через `@fontsource-variable/manrope`) — SIL Open Font License 1.1.

## Библиотеки

| Пакет | Версия | Лицензия |
|---|---|---|
| next | 16.4.6 | MIT |
| react, react-dom | 19.3.1 | MIT |
| three | 0.187.0 | MIT |
| @react-three/fiber | 9.8.2 | MIT |
| @react-three/drei | 10.7.9 | MIT |
| motion | 14.13.0 | MIT |
| pg | 8.23.1 | MIT |
| sharp | 0.35.5 | Apache-2.0 (libvips — LGPL-3.0, динамическая линковка) |
| zod | 4.6.7 | MIT |
| @gltf-transform/cli (dev) | 4.5.1 | MIT |
| typescript, tsx (dev) | 5.9 / 4.x | Apache-2.0 / MIT |
