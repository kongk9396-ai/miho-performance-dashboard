
import Link from "next/link";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";


import AdminPerformanceDashboard from "@/components/AdminPerformanceDashboard";

export const dynamic =
  "force-dynamic";

function currentMonth() {
  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-01`;
}

export default async function AdminPage() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      ADMIN_COOKIE_NAME
    )?.value;

  if (
    !verifyAdminSession(token)
  ) {
    redirect("/login");
  }  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-black tracking-tight"
          >
            MIHO Performance
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/"
              className="rounded-lg px-3 py-2 font-semibold text-zinc-500 hover:bg-zinc-100"
            >
              전체 대시보드
            </Link>

            <Link
              href="/admin/import"
              className="rounded-lg bg-zinc-900 px-3 py-2 font-semibold text-white"
            >
              데이터 입력
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-6 py-8">
        <AdminPerformanceDashboard
          initialMonth={
            currentMonth()
          }
        />
      </div>
    </main>
  );
}
