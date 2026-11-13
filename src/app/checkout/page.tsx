import type { Metadata } from "next";
import CheckoutForm from "@/components/CheckoutForm";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Оформление заявки", robots: { index: false } };

export default async function Checkout() {
  const s = await getSettings();
  return (
    <div className="page wrap">
      <h1>Оформление заявки</h1>
      <CheckoutForm pricing={s.pricing} privacyHref="/privacy" />
    </div>
  );
}
