import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/server/auth";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Вход в кабинет", robots: { index: false } };

export default async function Login() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="page wrap" style={{ maxWidth: 420 }}>
      <h1>Кабинет владельца</h1>
      <LoginForm />
    </div>
  );
}
