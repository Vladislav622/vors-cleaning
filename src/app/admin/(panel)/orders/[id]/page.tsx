import { notFound } from "next/navigation";
import AdminOrderDetail from "@/components/admin/AdminOrderDetail";
import { getAdminOrder } from "@/lib/server/admin-orders";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const o = await getAdminOrder((await params).id);
  if (!o) notFound();
  return <AdminOrderDetail initial={JSON.parse(JSON.stringify(o))} tz={process.env.APP_TZ || "Asia/Almaty"} />;
}
