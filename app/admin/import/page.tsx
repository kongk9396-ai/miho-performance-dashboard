import ExcelImportManager from "@/components/ExcelImportManager";

export const dynamic =
  "force-dynamic";

export default function ImportPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
        <header className="mb-8">
          <a
            href="/admin"
            className="text-sm font-semibold text-blue-600"
          >
            ← 월간 실적 관리
          </a>

          <p className="mt-5 text-sm font-bold text-blue-600">
            MIHO PERFORMANCE ·
            ADMIN
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            기존 엑셀 가져오기
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            기존 통계 파일을 그대로
            업로드해 과거 데이터를
            일괄 등록합니다.
          </p>
        </header>

        <ExcelImportManager />
      </div>
    </main>
  );
}