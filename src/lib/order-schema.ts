import { z } from "zod";
import { CATEGORY_BY_ID, VARIANT_BY_ID, type CategoryId, type VariantId } from "./catalog";

export const MAX_PHOTOS = 3;
export const STATUSES = ["new", "agreed", "done", "cancelled"] as const;
export type OrderStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Новая",
  agreed: "Согласована",
  done: "Завершена",
  cancelled: "Отменена",
};

export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return "+7" + d.slice(1);
  if (d.length === 10) return "+7" + d;
  return "+" + d;
}

const item = z
  .object({
    category: z.enum(["sofa", "armchair", "mattress", "chair", "other"]),
    variant: z.string().nullish(),
    qty: z.number().int().min(1, "Минимум 1").max(20, "Не больше 20"),
    heavy: z.boolean(),
    secondSide: z.boolean().optional(),
    description: z.string().trim().max(500, "Не больше 500 символов").optional(),
  })
  .superRefine((v, ctx) => {
    const cat = CATEGORY_BY_ID[v.category as CategoryId];
    if (v.category === "other") {
      if (!v.description || v.description.length < 3) ctx.addIssue({ code: "custom", path: ["description"], message: "Опишите предмет" });
    } else if (!v.variant || VARIANT_BY_ID[v.variant as VariantId]?.category !== cat.id) {
      ctx.addIssue({ code: "custom", path: ["variant"], message: "Выберите вариант" });
    }
  });

export const orderInputSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
    items: z.array(item).min(1, "Добавьте хотя бы один предмет").max(30),
    name: z.string().trim().min(2, "Укажите имя").max(80),
    phone: z
      .string()
      .trim()
      .refine((v) => {
        const d = v.replace(/\D/g, "");
        return d.length >= 10 && d.length <= 15;
      }, "Проверьте номер телефона"),
    address: z.string().trim().min(5, "Укажите адрес").max(300),
    outOfTown: z.boolean(),
    wishDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish()
      .or(z.literal("")),
    wishTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Неверное время")
      .nullish()
      .or(z.literal("")),
    comment: z.string().trim().max(1000).optional().default(""),
    consent: z.literal(true, { error: "Нужно согласие на обработку данных" }),
    photos: z
      .array(z.object({ id: z.string().uuid(), secret: z.string().min(16).max(100) }))
      .max(MAX_PHOTOS, `Не больше ${MAX_PHOTOS} фото`)
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (v.wishTime && !v.wishDate) ctx.addIssue({ code: "custom", path: ["wishDate"], message: "Для времени нужна дата" });
    if (v.wishDate) {
      const d = new Date(v.wishDate + "T00:00:00Z");
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (Number.isNaN(d.getTime())) ctx.addIssue({ code: "custom", path: ["wishDate"], message: "Неверная дата" });
      else if (d.getTime() < today.getTime() - 864e5) ctx.addIssue({ code: "custom", path: ["wishDate"], message: "Дата уже прошла" });
      else if (d.getTime() > today.getTime() + 180 * 864e5) ctx.addIssue({ code: "custom", path: ["wishDate"], message: "Не дальше чем через полгода" });
    }
    if (v.items.some((i) => i.category === "other") && v.photos.length === 0)
      ctx.addIssue({ code: "custom", path: ["photos"], message: "Для «Другое» приложите хотя бы одно фото" });
  });

export type OrderInput = z.infer<typeof orderInputSchema>;

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export const adminOrderPatchSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    finalPrice: z.number().int().min(0).max(100_000_000).nullable().optional(),
    agreedVisitAt: z.string().datetime({ offset: true }).nullable().optional(),
    ownerNote: z.string().max(4000).nullable().optional(),
  })
  .strict();
