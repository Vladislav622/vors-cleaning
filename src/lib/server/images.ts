import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export class ImageError extends Error {}

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Проверяет реальный формат по сигнатуре и декодеру, снимает EXIF (в т.ч. геометки), ужимает до 1600 px WebP */
export async function normalizeImage(buf: Buffer) {
  if (buf.length === 0) throw new ImageError("Файл пустой.");
  if (buf.length > MAX_UPLOAD_BYTES) throw new ImageError("Файл больше 12 МБ.");
  const kind = sniff(buf);
  if (!kind) throw new ImageError("Подходят только JPEG, PNG и WebP.");
  let meta;
  try {
    meta = await sharp(buf, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new ImageError("Не удалось прочитать изображение.");
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ImageError("Подходят только JPEG, PNG и WebP.");
  if ((meta.width ?? 0) < 64 || (meta.height ?? 0) < 64) throw new ImageError("Слишком маленькое изображение.");
  const out = await sharp(buf, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height, mime: "image/webp" };
}
