// Генерирует PWA-иконки и OG-картинку из SVG-знака. Цвет берётся из аргумента: node scripts/make-icons.mjs "#2F6F62"
import sharp from "sharp";
const accent = process.argv[2] || "#2F6F62";
const mark = (size, pad) => {
  const s = size, p = pad, w = s - 2 * p;
  const eye = w * 0.075;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="#EEF1EF"/>
  <rect x="${p}" y="${p}" width="${w}" height="${w}" rx="${w * 0.26}" fill="${accent}"/>
  <rect x="${p + w * 0.33 - eye / 2}" y="${p + w * 0.36}" width="${eye}" height="${eye * 1.6}" rx="${eye / 2}" fill="#fff"/>
  <rect x="${p + w * 0.67 - eye / 2}" y="${p + w * 0.36}" width="${eye}" height="${eye * 1.6}" rx="${eye / 2}" fill="#fff"/>
  <path d="M ${p + w * 0.4} ${p + w * 0.62} Q ${p + w * 0.5} ${p + w * 0.7} ${p + w * 0.6} ${p + w * 0.62}" stroke="#fff" stroke-width="${w * 0.045}" fill="none" stroke-linecap="round"/>
</svg>`;
};
const out = [
  ["public/icons/icon-192.png", 192, 14],
  ["public/icons/icon-512.png", 512, 36],
  ["public/icons/maskable-512.png", 512, 96],
  ["public/icons/apple-touch-icon.png", 180, 14],
  ["src/app/favicon.ico", 48, 3],
];
for (const [file, size, pad] of out) {
  const img = sharp(Buffer.from(mark(size, pad)));
  if (file.endsWith(".ico")) await img.png().toFile("public/favicon.png");
  else await img.png().toFile(file);
}
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#EEF1EF"/>
<rect x="90" y="215" width="200" height="200" rx="52" fill="${accent}"/><rect x="152" y="287" width="16" height="26" rx="8" fill="#fff"/><rect x="212" y="287" width="16" height="26" rx="8" fill="#fff"/>
<path d="M170 345 Q190 362 210 345" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/>
<text x="340" y="310" font-family="Manrope, Arial, sans-serif" font-size="88" font-weight="800" fill="#17201D">Химчистка мебели</text>
<text x="340" y="380" font-family="Manrope, Arial, sans-serif" font-size="40" fill="#5B6763">Выберите мебель — цена сразу, мастер приедет</text></svg>`;
await sharp(Buffer.from(og)).png().toFile("public/og.png");
console.log("Иконки готовы");
