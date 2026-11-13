import Configurator from "@/components/Configurator";
import { CATEGORY_BY_ID, type CategoryId } from "@/lib/catalog";
import { publicSettings } from "@/lib/settings-schema";
import { getSettings } from "@/lib/server/settings";

export default async function Home({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const s = await getSettings();
  const { c } = await searchParams;
  const initial = c && c in CATEGORY_BY_ID ? (c as CategoryId) : undefined;
  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <Configurator settings={publicSettings(s)} initialCategory={initial} />
    </div>
  );
}
