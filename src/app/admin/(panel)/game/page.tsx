import SettingsForm from "@/components/admin/SettingsForm";
import { loadSettings } from "@/lib/server/settings";

export default async function Page() {
  const s = await loadSettings();
  return <SettingsForm section="game" initial={s} />;
}
