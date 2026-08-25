import TelegramPasteManager from "@/components/TelegramPasteManager";

export const dynamic =
  "force-dynamic";

export default function TelegramPastePage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
        <header className="mb-8">
          <a
            href="/admin"
            className="text-sm font-semibold text-blue-600"
          >
            ← 관리자
          </a>

          <p className="mt-5 text-sm font-bold text-blue-600">
            MIHO PERFORMANCE · ADMIN
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            텔레그램 DB 자동 입력
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            일일 DB 보고 메시지를 그대로 붙여넣어 실적 데이터를 등록합니다.
          </p>
        </header>

        <TelegramPasteManager />
      </div>
    </main>
  );
}