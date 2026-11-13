// Каталог услуг: категории и варианты. Цены живут в настройках компании, здесь — только структура.
export type CategoryId = "sofa" | "armchair" | "mattress" | "chair" | "other";
export type VariantId =
  | "sofa-2"
  | "sofa-3"
  | "sofa-corner"
  | "armchair-standard"
  | "armchair-recliner"
  | "mattress-single"
  | "mattress-double"
  | "chair-seat"
  | "chair-seat-back";

export interface Variant {
  id: VariantId;
  label: string;
  hint: string;
}

export interface Category {
  id: CategoryId;
  label: string;
  plural: string;
  variants: Variant[];
  /** Модель, показываемая для «Другое» и как запасной вариант */
  model: string;
  /** Масштаб сцены для категории, чтобы варианты одной категории сохраняли относительный размер */
  sceneScale: number;
  hasSecondSide?: boolean;
  manual?: boolean;
}

export const CATEGORIES: Category[] = [
  {
    id: "sofa",
    label: "Диван",
    plural: "Диваны",
    model: "sofa-2",
    sceneScale: 0.92,
    variants: [
      { id: "sofa-2", label: "2 места", hint: "Компактный, до 160 см" },
      { id: "sofa-3", label: "3 места", hint: "Прямой, 180–230 см" },
      { id: "sofa-corner", label: "Угловой", hint: "С оттоманкой или углом" },
    ],
  },
  {
    id: "armchair",
    label: "Кресло",
    plural: "Кресла",
    model: "armchair-standard",
    sceneScale: 1.45,
    variants: [
      { id: "armchair-standard", label: "Обычное", hint: "Мягкое кресло" },
      { id: "armchair-recliner", label: "Реклайнер", hint: "С выдвижной подножкой" },
    ],
  },
  {
    id: "mattress",
    label: "Матрас",
    plural: "Матрасы",
    model: "mattress-single",
    sceneScale: 0.98,
    hasSecondSide: true,
    variants: [
      { id: "mattress-single", label: "Односпальный", hint: "До 120 см шириной" },
      { id: "mattress-double", label: "Двуспальный", hint: "От 140 см шириной" },
    ],
  },
  {
    id: "chair",
    label: "Стул",
    plural: "Стулья",
    model: "chair-seat-back",
    sceneScale: 1.75,
    variants: [
      { id: "chair-seat", label: "Сиденье", hint: "Мягкое только сиденье" },
      { id: "chair-seat-back", label: "Сиденье и спинка", hint: "Мягкие сиденье и спинка" },
    ],
  },
  {
    id: "other",
    label: "Другое",
    plural: "Другое",
    model: "other",
    sceneScale: 2.0,
    manual: true,
    variants: [],
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;
export const VARIANT_IDS = CATEGORIES.flatMap((c) => c.variants.map((v) => v.id)) as VariantId[];
export const VARIANT_BY_ID = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.variants.map((v) => [v.id, { ...v, category: c.id }])),
) as Record<VariantId, Variant & { category: CategoryId }>;

export function modelFor(category: CategoryId, variant?: VariantId | null): string {
  if (variant && VARIANT_BY_ID[variant]?.category === category) return variant;
  return CATEGORY_BY_ID[category].model;
}

export function itemTitle(category: CategoryId, variant?: VariantId | null): string {
  const c = CATEGORY_BY_ID[category];
  if (!variant) return c.label;
  return `${c.label}, ${(VARIANT_BY_ID[variant]?.label ?? "").toLowerCase()}`;
}

export const ALL_MODELS = [...VARIANT_IDS, "other"];
