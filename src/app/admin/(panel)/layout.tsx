import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/server/auth";
import AdminTabs from "@/components/admin/AdminTabs";

export const metadata: Metadata = { title: "Кабинет", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <div className="admin wrap">
      <AdminTabs />
      {children}
    </div>
  );
}
