import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/order-schema";
import { charactersSchema, companySchema, gameSchema, pricingSchema, type Settings } from "@/lib/settings-schema";
import { requireAdmin } from "@/lib/server/admin-guard";
import { jsonError } from "@/lib/server/security";
import { loadSettings, saveSettingsSection } from "@/lib/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECTIONS = { pricing: pricingSchema, company: companySchema, game: gameSchema, characters: charactersSchema } as const;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json(await loadSettings(), { headers: { "cache-control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { section?: keyof Settings; value?: unknown } | null;
  const section = body?.section;
  if (!section || !(section in SECTIONS)) return jsonError(400, "Неизвестный раздел.");
  const parsed = SECTIONS[section].safeParse(body.value);
  if (!parsed.success) return jsonError(422, "Проверьте поля.", { fieldErrors: fieldErrors(parsed.error) });
  const next = await saveSettingsSection(section, parsed.data as never);
  revalidatePath("/", "layout");
  return NextResponse.json(next);
}
