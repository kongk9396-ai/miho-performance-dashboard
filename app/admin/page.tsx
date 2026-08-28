import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Settings,
  Users,
} from "lucide-react";

import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const menuGroups = [
  {
    title: "데이터 입력",
    description: "기존 자료를 빠르게 등록하고 수정합니다.",
    items: [
      {
        title: "텔레그램 붙여넣기",
        description:
          "텔레그램 일별 보고 메시지를 그대로 붙여넣어 저장합니다.",
        href: "/admin/paste",
        icon: MessageSquareText,
      },
      {
        title: "엑셀 일괄 가져오기",
        description:
          "기존 엑셀 파일을 업로드해 과거 데이터를 한 번에 등록합니다.",
        href: "/admin/import",
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    title: "실적 관리",
    description: "상담실장 실적과 담당자를 관리합니다.",
    items: [
      {
        title: "일별 상담 · 수술 입력",
        description:
          "날짜별 상담 건수와 수술 건수를 입력하고 상담 대비 수술 비율을 관리합니다.",
        href: "/admin/conversion",
        icon: BarChart3,
      },
      {
        title: "실장별 실적 · 매출",
        description:
          "월별 상담, 수술 전환, 전환율과 매출을 확인합니다.",
        href: "/admin/performance",
        icon: BarChart3,
      },
      {
        title: "실장 관리",
        description:
          "실장 추가, 수정, 정렬 및 활성 상태를 관리합니다.",
        href: "/admin/managers",
        icon: Users,
      },
    ],
  },
  {
    title: "채널 관리",
    description: "대시보드에서 사용하는 유입 플랫폼을 관리합니다.",
    items: [
      {
        title: "플랫폼 관리",
        description:
          "플랫폼 추가 및 합계·채널 차트 포함 여부를 설정합니다.",
        href: "/admin/platforms",
        icon: Megaphone,
      },
    ],
  },
];

export default async function AdminPage() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    ADMIN_COOKIE_NAME
  )?.value;

  if (!verifyAdminSession(token)) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-blue-600">
              MIHO PERFORMANCE · ADMIN
            </p>

            <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-950">
              관리자
            </h1>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <LayoutDashboard size={17} />
            대시보드로 돌아가기
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <section className="mb-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Settings size={21} />
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-950">
                관리 메뉴
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                데이터 입력부터 실적·플랫폼 관리까지 여기서 바로 이동할 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-10">
          {menuGroups.map((group) => (
            <section key={group.title}>
              <div className="mb-4">
                <h3 className="text-base font-black text-zinc-950">
                  {group.title}
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  {group.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                          <Icon size={20} />
                        </div>

                        <div>
                          <h4 className="font-black text-zinc-950">
                            {item.title}
                          </h4>

                          <p className="mt-2 text-sm leading-6 text-zinc-500">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-blue-100 bg-blue-50/60 p-6">
          <div className="flex gap-4">
            <Database
              size={20}
              className="mt-0.5 shrink-0 text-blue-600"
            />

            <div>
              <p className="font-black text-zinc-900">
                데이터 입력은 한 번만
              </p>

              <p className="mt-1 text-sm leading-6 text-zinc-600">
                텔레그램 붙여넣기 또는 엑셀 일괄 가져오기로 등록한
                데이터는 월간·일별 대시보드에서 함께 사용됩니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
