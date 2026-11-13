import { z } from "zod";
import { VARIANT_IDS, type VariantId } from "./catalog";

const money = z.number().int().min(0).max(10_000_000);
const pct = z.number().min(0).max(500);

const variantPrices = z.object(
  Object.fromEntries(VARIANT_IDS.map((id) => [id, money])) as Record<VariantId, typeof money>,
);

export const pricingSchema = z.object({
  currency: z.string().trim().min(1).max(6),
  roundingStep: z.number().int().min(1).max(10_000),
  minOrder: money,
  heavySoilingPct: pct,
  secondSidePct: pct,
  outOfTownFee: money,
  variants: variantPrices,
});

const optionalText = (max: number) => z.string().trim().max(max).default("");

export const companySchema = z.object({
  name: z.string().trim().min(1).max(60),
  tagline: optionalText(140),
  city: optionalText(60),
  territory: optionalText(200),
  phone: optionalText(30),
  whatsapp: optionalText(30),
  telegram: optionalText(40),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).default(""),
  workHours: optionalText(80),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  legalName: optionalText(160),
  demo: z.boolean().default(false),
});

export const gameSchema = z.object({
  mode: z.enum(["off", "play", "bonus"]),
  bonusAmount: money,
  validDays: z.number().int().min(1).max(730),
  minNextOrder: money,
});

export const charactersSchema = z.object({
  preset: z.enum(["calm", "cheerful", "laconic"]),
  showFaces: z.boolean(),
  showPhrases: z.boolean(),
});

export const settingsSchema = z.object({
  pricing: pricingSchema,
  company: companySchema,
  game: gameSchema,
  characters: charactersSchema,
});

export type Pricing = z.infer<typeof pricingSchema>;
export type Company = z.infer<typeof companySchema>;
export type GameSettings = z.infer<typeof gameSchema>;
export type CharacterSettings = z.infer<typeof charactersSchema>;
export type Settings = z.infer<typeof settingsSchema>;

/** Стартовые значения. Компания вымышленная, контакты пустые до настройки владельцем. */
export const DEFAULT_SETTINGS: Settings = {
  pricing: {
    currency: "₸",
    roundingStep: 100,
    minOrder: 8000,
    heavySoilingPct: 30,
    secondSidePct: 70,
    outOfTownFee: 3000,
    variants: {
      "sofa-2": 12000,
      "sofa-3": 15000,
      "sofa-corner": 19000,
      "armchair-standard": 6000,
      "armchair-recliner": 8000,
      "mattress-single": 7000,
      "mattress-double": 10000,
      "chair-seat": 1500,
      "chair-seat-back": 2500,
    },
  },
  company: {
    name: "Ворс",
    tagline: "Выездная химчистка мягкой мебели",
    city: "",
    territory: "",
    phone: "",
    whatsapp: "",
    telegram: "",
    email: "",
    workHours: "",
    accent: "#2F6F62",
    legalName: "",
    demo: false,
  },
  game: { mode: "play", bonusAmount: 1000, validDays: 60, minNextOrder: 8000 },
  characters: { preset: "cheerful", showFaces: true, showPhrases: true },
};

/** Часть настроек, которую безопасно отдавать в браузер */
export function publicSettings(s: Settings) {
  return {
    pricing: s.pricing,
    company: s.company,
    game: { mode: s.game.mode, bonusAmount: s.game.bonusAmount, validDays: s.game.validDays, minNextOrder: s.game.minNextOrder },
    characters: s.characters,
  };
}
export type PublicSettings = ReturnType<typeof publicSettings>;
