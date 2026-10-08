from pathlib import Path
import re
import shutil
from datetime import datetime

ROOT = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard")
stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

dashboard = ROOT / "components" / "DashboardClient.tsx"
preview = ROOT / "app" / "api" / "admin" / "import" / "preview" / "route.ts"
commit = ROOT / "app" / "api" / "admin" / "import" / "commit" / "route.ts"

for p in [dashboard, preview, commit]:
    shutil.copy2(p, str(p) + f".bak_daily_excel_{stamp}")

# =========================================================
# 1. IMPORT PREVIEW
# =========================================================

text = preview.read_text(encoding="utf-8")

# ---------- 타입 추가 ----------
text = text.replace(
'''type DailyPlatformRow = {
  date: string;
  platform: string;
  applications: number;
  reservations: number;
};''',
'''type DailyPlatformRow = {
  date: string;
  platform: string;
  applications: number;
  reservations: number;
};

type DailyConversionRow = {
  date: string;
  consultations: number;
  surgeries: number;
};'''
)

text = text.replace(
'''  dailyPlatforms: DailyPlatformRow[];
  consultations: number | null;
  surgeries: number | null;''',
'''  dailyPlatforms: DailyPlatformRow[];
  dailyConversions: DailyConversionRow[];
  consultations: number | null;
  surgeries: number | null;'''
)

# SheetCandidate에도 없으면 추가
text = text.replace(
'''  dailyPlatforms: DailyPlatformRow[];
  consultations: number | null;
  surgeries: number | null;
  conversionScore: number;''',
'''  dailyPlatforms: DailyPlatformRow[];
  dailyConversions: DailyConversionRow[];
  consultations: number | null;
  surgeries: number | null;
  conversionScore: number;'''
)

# accumulator
text = text.replace(
'''  dailyMap: Map<string, DailyPlatformRow>;
  consultations: number | null;''',
'''  dailyMap: Map<string, DailyPlatformRow>;
  dailyConversionMap: Map<string, DailyConversionRow>;
  consultations: number | null;'''
)

# ---------- 일별 상담/수술전환 파서 ----------
marker = "function parseMonthlyConversionLayout(rows: unknown[][]) {"

daily_parser = r'''
function parseDailyConversionLayout(
  rows: unknown[][],
  month: string
) {
  const result: DailyConversionRow[] = [];

  let headerRow = -1;
  let dateCol = -1;
  let consultationCol = -1;
  let conversionCol = -1;

  for (let r = 0; r < Math.min(rows.length, 100); r++) {
    const row = rows[r] ?? [];

    let foundDate = -1;
    let foundConsult = -1;
    let foundConversion = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = compactText(row[c]);

      if (
        cell === "일자" ||
        cell === "날짜"
      ) {
        foundDate = c;
      }

      if (
        cell === "상담" ||
        cell === "상담수" ||
        cell === "상담건수" ||
        cell === "실상담"
      ) {
        foundConsult = c;
      }

      if (
        cell === "수술전환" ||
        cell === "수술전환수" ||
        cell === "수술결정" ||
        cell === "수술결정수"
      ) {
        foundConversion = c;
      }
    }

    if (
      foundDate >= 0 &&
      foundConsult >= 0 &&
      foundConversion >= 0
    ) {
      headerRow = r;
      dateCol = foundDate;
      consultationCol = foundConsult;
      conversionCol = foundConversion;
      break;
    }
  }

  if (
    headerRow < 0 ||
    dateCol < 0 ||
    consultationCol < 0 ||
    conversionCol < 0
  ) {
    return {
      rows: result,
      consultations: null as number | null,
      surgeries: null as number | null,
      score: 0,
    };
  }

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];

    const rawDate = row[dateCol];

    if (
      compactText(rawDate) === "합계" ||
      compactText(rawDate) === "총합"
    ) {
      break;
    }

    const date = toDateString(rawDate, month);

    if (!date || monthKey(date) !== monthKey(month)) {
      continue;
    }

    const consultations = intValue(row[consultationCol]);
    const surgeries = intValue(row[conversionCol]);

    if (
      consultations === null &&
      surgeries === null
    ) {
      continue;
    }

    result.push({
      date,
      consultations: consultations ?? 0,
      surgeries: surgeries ?? 0,
    });
  }

  const totalConsultations =
    result.reduce(
      (sum, row) => sum + row.consultations,
      0
    );

  const totalSurgeries =
    result.reduce(
      (sum, row) => sum + row.surgeries,
      0
    );

  return {
    rows: result,
    consultations:
      result.length > 0
        ? totalConsultations
        : null,
    surgeries:
      result.length > 0
        ? totalSurgeries
        : null,
    score:
      result.length > 0
        ? 1200 + result.length
        : 0,
  };
}

'''

if marker not in text:
    raise SystemExit("PREVIEW: parseMonthlyConversionLayout 위치를 못 찾았습니다.")

if "function parseDailyConversionLayout(" not in text:
    text = text.replace(marker, daily_parser + marker)

# ---------- parseSheet ----------
old = '''  const conversion = parseMonthlyConversionLayout(rows);'''

new = '''  const conversion = parseMonthlyConversionLayout(rows);
  const dailyConversion =
    parseDailyConversionLayout(rows, month);

  if (
    dailyConversion.score > conversion.score
  ) {
    conversion.consultations =
      dailyConversion.consultations;
    conversion.surgeries =
      dailyConversion.surgeries;
    conversion.score =
      dailyConversion.score;
  }'''

text = text.replace(old, new)

# null 판단
text = text.replace(
'''    dailyLayout.dailyPlatforms.length === 0 &&
    conversion.score === 0''',
'''    dailyLayout.dailyPlatforms.length === 0 &&
    dailyConversion.rows.length === 0 &&
    conversion.score === 0'''
)

# parseSheet return
text = text.replace(
'''    dailyPlatforms: dailyLayout.dailyPlatforms,
    consultations: conversion.consultations,''',
'''    dailyPlatforms: dailyLayout.dailyPlatforms,
    dailyConversions: dailyConversion.rows,
    consultations: conversion.consultations,'''
)

# accumulator 생성
text = text.replace(
'''    dailyMap: new Map(),
    consultations: null,''',
'''    dailyMap: new Map(),
    dailyConversionMap: new Map(),
    consultations: null,'''
)

# mergeCandidate 안에 일별 conversion 병합
needle = '''  if (candidate.conversionScore > accumulator.conversionScore) {'''

merge_code = '''  for (const row of candidate.dailyConversions ?? []) {
    accumulator.dailyConversionMap.set(
      row.date,
      row
    );
  }

'''

if merge_code.strip() not in text:
    text = text.replace(needle, merge_code + needle)

# preview 결과에 dailyConversions 추가
needle = '''        const dailyPlatforms = Array.from(item.dailyMap.values()).sort((a, b) =>
          a.date === b.date
            ? a.platform.localeCompare(b.platform, "ko")
            : a.date.localeCompare(b.date)
        );'''

replacement = needle + '''

        const dailyConversions =
          Array.from(
            item.dailyConversionMap.values()
          ).sort(
            (a, b) =>
              a.date.localeCompare(b.date)
          );'''

text = text.replace(needle, replacement)

text = text.replace(
'''          dailyPlatforms,
          consultations: item.consultations,''',
'''          dailyPlatforms,
          dailyConversions,
          consultations: item.consultations,'''
)

preview.write_text(text, encoding="utf-8")


# =========================================================
# 2. IMPORT COMMIT
# =========================================================

text = commit.read_text(encoding="utf-8")

# import dailyConversionStats
text = text.replace(
'''  dailyPlatformStats,
  monthlyConversionStats,''',
'''  dailyPlatformStats,
  dailyConversionStats,
  monthlyConversionStats,'''
)

# ImportMonth 타입
text = text.replace(
'''  dailyPlatforms?: {
    date: string;
    platform: string;
    applications: number;
    reservations: number;
  }[];
  consultations: number | null;''',
'''  dailyPlatforms?: {
    date: string;
    platform: string;
    applications: number;
    reservations: number;
  }[];
  dailyConversions?: {
    date: string;
    consultations: number;
    surgeries: number;
  }[];
  consultations: number | null;'''
)

# counter
text = text.replace(
'''    let dailyRowsSaved = 0;
    let conversionMonthsSaved = 0;''',
'''    let dailyRowsSaved = 0;
    let dailyConversionRowsSaved = 0;
    let conversionMonthsSaved = 0;'''
)

# 월 conversion 저장 바로 앞에 일별 저장 삽입
needle = '''      const shouldWriteConversion =
        hasIncomingConversion &&
        (mode === "overwrite" || existingConversion.length === 0);'''

daily_commit = r'''
      /*
       * 일별 상담 / 수술전환 일괄 저장
       */
      const incomingDailyConversions =
        Array.isArray(monthData.dailyConversions)
          ? monthData.dailyConversions.filter(
              (row) =>
                isValidDate(row.date) &&
                row.date >= monthStart &&
                row.date < nextMonthStart
            )
          : [];

      if (incomingDailyConversions.length > 0) {
        const values =
          incomingDailyConversions.map(
            (row) => ({
              date: row.date,
              consultations:
                safeNumber(row.consultations),
              surgeries:
                safeNumber(row.surgeries),
            })
          );

        await db
          .insert(dailyConversionStats)
          .values(values)
          .onConflictDoUpdate({
            target:
              dailyConversionStats.date,
            set: {
              consultations:
                sql`excluded.consultations`,
              surgeries:
                sql`excluded.surgeries`,
              updatedAt:
                new Date(),
            },
          });

        dailyConversionRowsSaved +=
          values.length;

        wroteSomething = true;
      }

'''

if needle not in text:
    raise SystemExit("COMMIT: monthly conversion 저장 위치를 못 찾았습니다.")

if "incomingDailyConversions" not in text:
    text = text.replace(
        needle,
        daily_commit + needle
    )

text = text.replace(
'''      dailyRowsSaved,
      conversionMonthsSaved,''',
'''      dailyRowsSaved,
      dailyConversionRowsSaved,
      conversionMonthsSaved,'''
)

commit.write_text(text, encoding="utf-8")


# =========================================================
# 3. DASHBOARD
# =========================================================

text = dashboard.read_text(encoding="utf-8")

# selected category state 제거
text = re.sub(
    r'\s*const \[selectedCategoryTrend, setSelectedCategoryTrend\]\s*=\s*useState\("코"\);\s*',
    '\n',
    text,
    count=1
)

# 카테고리별 상담·수술 블록 + 카테고리 일별 추이 블록을
# 플랫폼 상세 직전까지 통으로 교체
start = text.find(
    '<h2 className="text-lg font-bold">\n                       카테고리별 상담 · 수술'
)

if start == -1:
    start = text.find("카테고리별 상담 · 수술")

if start == -1:
    raise SystemExit("DASHBOARD: 카테고리별 상담 · 수술 위치를 못 찾았습니다.")

section_start = text.rfind(
    '<section className="mt-6">',
    0,
    start
)

platform_marker = '''            <section className="mt-6">
              <PlatformDetailTable'''

section_end = text.find(
    platform_marker,
    start
)

if section_start == -1 or section_end == -1:
    raise SystemExit("DASHBOARD: 교체 영역 끝 위치를 못 찾았습니다.")

new_section = r'''            <section className="mt-6">
              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-zinc-900">
                      상담 대비 수술 전환
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                      선택 월 기준 · 일별 상담 및 수술결정 집계
                    </p>
                  </div>

                  <a
                    href="/admin/import"
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    엑셀 일괄 업로드 →
                  </a>
                </div>

                {(() => {
                  const rows =
                    dashboardData.dailyConversions ?? [];

                  const consultations =
                    rows.length > 0
                      ? rows.reduce(
                          (sum, row) =>
                            sum + row.consultations,
                          0
                        )
                      : current.consultations;

                  const conversions =
                    rows.length > 0
                      ? rows.reduce(
                          (sum, row) =>
                            sum + row.surgeries,
                          0
                        )
                      : current.surgeries;

                  const rate =
                    consultations > 0
                      ? (conversions /
                          consultations) *
                        100
                      : 0;

                  return (
                    <>
                      <div className="mt-6 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl bg-zinc-50 p-5">
                          <p className="text-xs font-bold text-zinc-500">
                            상담
                          </p>

                          <p className="mt-2 text-3xl font-black text-zinc-900">
                            {consultations.toLocaleString()}
                            <span className="ml-1 text-sm font-semibold text-zinc-400">
                              건
                            </span>
                          </p>
                        </div>

                        <div className="rounded-2xl bg-zinc-50 p-5">
                          <p className="text-xs font-bold text-zinc-500">
                            수술 전환
                          </p>

                          <p className="mt-2 text-3xl font-black text-zinc-900">
                            {conversions.toLocaleString()}
                            <span className="ml-1 text-sm font-semibold text-zinc-400">
                              건
                            </span>
                          </p>
                        </div>

                        <div className="rounded-2xl bg-blue-50 p-5">
                          <p className="text-xs font-bold text-blue-600">
                            상담 → 수술 전환율
                          </p>

                          <p className="mt-2 text-3xl font-black text-blue-700">
                            {rate.toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                              <th className="px-3 py-3">일자</th>
                              <th className="px-3 py-3 text-right">상담</th>
                              <th className="px-3 py-3 text-right">수술 전환</th>
                              <th className="px-3 py-3 text-right">전환율</th>
                            </tr>
                          </thead>

                          <tbody>
                            {rows.map((row) => {
                              const rowRate =
                                row.consultations > 0
                                  ? (row.surgeries /
                                      row.consultations) *
                                    100
                                  : 0;

                              return (
                                <tr
                                  key={row.date}
                                  className="border-b border-zinc-100 text-sm"
                                >
                                  <td className="px-3 py-3 font-semibold text-zinc-700">
                                    {row.date.slice(5)}
                                  </td>

                                  <td className="px-3 py-3 text-right font-bold">
                                    {row.consultations.toLocaleString()}
                                  </td>

                                  <td className="px-3 py-3 text-right font-bold">
                                    {row.surgeries.toLocaleString()}
                                  </td>

                                  <td className="px-3 py-3 text-right font-black text-blue-600">
                                    {rowRate.toFixed(2)}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {rows.length === 0 && (
                          <div className="py-10 text-center text-sm text-zinc-400">
                            일별 상담/수술전환 데이터가 없습니다.
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </article>
            </section>


'''

text = (
    text[:section_start]
    + new_section
    + text[section_end:]
)

dashboard.write_text(text, encoding="utf-8")

print("")
print("==============================================")
print(" PATCH COMPLETE")
print("==============================================")
print("1. 카테고리 상담/수술 영역 제거")
print("2. 상담 대비 수술 전환 영역 추가")
print("3. 일별 상담/수술전환 엑셀 자동 파싱 추가")
print("4. daily_conversion_stats 일괄 저장 추가")
print("")
print("백업 suffix:", stamp)
