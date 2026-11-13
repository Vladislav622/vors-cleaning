import "server-only";
import { cache } from "react";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "../settings-schema";
import { q } from "./db";

function merge(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  const merged = {
    pricing: { ...DEFAULT_SETTINGS.pricing, ...(r.pricing ?? {}), variants: { ...DEFAULT_SETTINGS.pricing.variants, ...(r.pricing?.variants ?? {}) } },
    company: { ...DEFAULT_SETTINGS.company, ...(r.company ?? {}) },
    game: { ...DEFAULT_SETTINGS.game, ...(r.game ?? {}) },
    characters: { ...DEFAULT_SETTINGS.characters, ...(r.characters ?? {}) },
  };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function loadSettings(): Promise<Settings> {
  const r = await q<{ data: unknown }>("select data from settings where id = 1");
  return merge(r.rows[0]?.data);
}

/** Кешируется на один запрос рендера */
export const getSettings = cache(loadSettings);

export async function saveSettingsSection<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Settings> {
  const current = await loadSettings();
  const next = settingsSchema.parse({ ...current, [key]: value });
  await q(
    `insert into settings (id, data, updated_at) values (1, $1, now())
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [JSON.stringify(next)],
  );
  return next;
}
