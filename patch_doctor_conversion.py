from pathlib import Path
from datetime import datetime
import shutil
import re

ROOT = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard")
STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

SCHEMA = ROOT / "lib/db/schema.ts"
QUERIES = ROOT / "lib/db/queries.ts"
DASH = ROOT / "components/DashboardClient.tsx"

for p in [SCHEMA, QUERIES, DASH]:
    if not p.exists():
        raise SystemExit(f"파일 없음: {p}")
    shutil.copy2(p, Path(str(p) + f".bak_doctor_conversion_{STAMP}"))

print("백업 완료:", STAMP)

# ============================================================
# 1. schema.ts
# doctor_conversion_stats 추가
# ============================================================

schema = SCHEMA.read_text(encoding="utf-8")

if 'export const doctorConversionStats' not in schema:

    marker = 'export const dailyReports = pgTable('

    if marker not in schema:
        raise SystemExit("schema.ts에서 dailyReports 삽입 위치를 못 찾음")

    doctor_schema = r'''
/* ========================================
   원장별 상담 / 수술 전환
======================================== */

export const doctorConversionStats = pgTable(
  "doctor_conversion_stats",
  {
    id: serial("id").primaryKey(),

    date: date("date").notNull(),

    doctorName: text("doctor_name").notNull(),

    /*
     * 상담예약
     * DB 포함 예약된 상담 건수
     */
    reservations: integer("reservations")
      .notNull()
      .default(0),

    /*
     * 실제 상담 완료 건수
     */
    consultations: integer("consultations")
      .notNull()
      .default(0),

    /*
     * 상담 후 수술 결정 건수
     */
    surgeries: integer("surgeries")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    dateDoctorUnique: uniqueIndex(
      "doctor_conversion_stats_date_doctor_uq"
    ).on(
      table.date,
      table.doctorName
    ),
  })
);


'''

    schema = schema.replace(marker, doctor_schema + marker, 1)
    SCHEMA.write_text(schema, encoding="utf-8")
    print("OK schema.ts: doctorConversionStats 추가")
else:
    print("SKIP schema.ts: doctorConversionStats 이미 존재")


# ============================================================
# 2. queries.ts import에 doctorConversionStats 추가
# ============================================================

queries = QUERIES.read_text(encoding="utf-8")

if "doctorConversionStats" not in queries:

    # schema import 블록에서 dailyConversionStats 바로 뒤에 삽입
    patterns = [
        "dailyConversionStats,",
        "dailyConversionStats\n",
    ]

    changed = False

    for pat in patterns:
        if pat in queries:
            if pat.endswith(","):
                queries = queries.replace(
                    pat,
                    pat + "\n  doctorConversionStats,",
                    1
                )
            else:
                queries = queries.replace(
                    pat,
                    "dailyConversionStats,\n  doctorConversionStats,\n",
                    1
                )

            changed = True
            break

    if not changed:
        raise SystemExit(
            "queries.ts schema import에서 dailyConversionStats를 못 찾음"
        )

    print("OK queries.ts: doctorConversionStats import 추가")


# ============================================================
# 3. Promise.all 조회에 doctorConversionRows 추가
# ============================================================

if "doctorConversionRows," not in queries:

    old = """    dailyConversionRows,
    categoryConversionRows,
    visitSourceRows,"""

    new = """    dailyConversionRows,
    doctorConversionRows,
    categoryConversionRows,
    visitSourceRows,"""

    if old not in queries:
        raise SystemExit(
            "queries.ts Promise.all 결과 변수 위치를 못 찾음"
        )

    queries = queries.replace(old, new, 1)


    # dailyConversionStats SELECT 뒤에 원장 SELECT 추가
    target_regex = re.compile(
        r'''(db\s*
\s*\.select\(\{\s*
\s*date:\s*dailyConversionStats\.date,\s*
\s*consultations:\s*dailyConversionStats\.consultations,\s*
\s*surgeries:\s*dailyConversionStats\.surgeries,\s*
\s*\}\)\s*
\s*\.from\(dailyConversionStats\)\s*
\s*\.where\(\s*
\s*and\(\s*
\s*gte\(dailyConversionStats\.date,\s*queryStartDate\),\s*
\s*lt\(dailyConversionStats\.date,\s*queryNextDate\)\s*
\s*\)\s*
\s*\)\s*
\s*\.orderBy\(\s*
\s*asc\(dailyConversionStats\.date\)\s*
\s*\),)''',
        re.MULTILINE
    )

    m = target_regex.search(queries)

    if not m:
        raise SystemExit(
            "queries.ts에서 dailyConversionStats 조회 블록을 못 찾음"
        )

    doctor_query = r'''

      /*
       * 원장별 일별 상담 / 수술 전환
       */
      db
        .select({
          date: doctorConversionStats.date,
          doctorName: doctorConversionStats.doctorName,
          reservations: doctorConversionStats.reservations,
          consultations: doctorConversionStats.consultations,
          surgeries: doctorConversionStats.surgeries,
        })
        .from(doctorConversionStats)
        .where(
          and(
            gte(
              doctorConversionStats.date,
              queryStartDate
            ),
            lt(
              doctorConversionStats.date,
              queryNextDate
            )
          )
        )
        .orderBy(
          asc(doctorConversionStats.date)
        ),
'''

    queries = (
        queries[:m.end()]
        + doctor_query
        + queries[m.end():]
    )

    print("OK queries.ts: 원장 데이터 DB 조회 추가")


# ============================================================
# 4. 원장별 월 집계 생성
# ============================================================

if "const doctorConversions =" not in queries:

    marker = "  const categoryNames = ["

    if marker not in queries:
        raise SystemExit(
            "queries.ts categoryNames 위치를 못 찾음"
        )

    doctor_build = r'''
  /*
   * ========================================
   * 원장별 상담 / 수술 전환
   * ========================================
   */

  const doctorDailyConversions =
    doctorConversionRows
      .filter(
        (row) =>
          String(
            monthFromDate(row.date)
          ).slice(0, 7) ===
          String(month).slice(0, 7)
      )
      .map((row) => {
        const reservationRate =
          row.reservations > 0
            ? (row.surgeries /
                row.reservations) *
              100
            : 0;

        const consultationRate =
          row.consultations > 0
            ? (row.surgeries /
                row.consultations) *
              100
            : 0;

        return {
          date: row.date,
          doctorName: row.doctorName,
          reservations: row.reservations,
          consultations: row.consultations,
          surgeries: row.surgeries,
          reservationRate,
          consultationRate,
        };
      })
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      );


  const doctorMap =
    new Map<
      string,
      {
        doctorName: string;
        reservations: number;
        consultations: number;
        surgeries: number;
      }
    >();

  for (const row of doctorDailyConversions) {
    const current =
      doctorMap.get(row.doctorName) ?? {
        doctorName: row.doctorName,
        reservations: 0,
        consultations: 0,
        surgeries: 0,
      };

    current.reservations +=
      row.reservations;

    current.consultations +=
      row.consultations;

    current.surgeries +=
      row.surgeries;

    doctorMap.set(
      row.doctorName,
      current
    );
  }


  const doctorConversions =
    Array.from(
      doctorMap.values()
    )
      .map((row) => ({
        ...row,

        reservationRate:
          row.reservations > 0
            ? (row.surgeries /
                row.reservations) *
              100
            : 0,

        consultationRate:
          row.consultations > 0
            ? (row.surgeries /
                row.consultations) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.consultationRate -
          a.consultationRate
      );


'''

    queries = queries.replace(
        marker,
        doctor_build + marker,
        1
    )

    print("OK queries.ts: 원장별 집계 추가")


# ============================================================
# 5. return 값 추가
# ============================================================

if re.search(r'\n\s*doctorConversions,\s*\n', queries) is None:

    target = """    dailyConversions,
    categoryConversions,"""

    replacement = """    dailyConversions,
    doctorConversions,
    doctorDailyConversions,
    categoryConversions,"""

    if target not in queries:
        raise SystemExit(
            "queries.ts return 위치를 못 찾음"
        )

    queries = queries.replace(
        target,
        replacement,
        1
    )

    print("OK queries.ts: doctorConversions 응답 추가")


QUERIES.write_text(
    queries,
    encoding="utf-8"
)


# ============================================================
# 6. DashboardData 타입 추가
# ============================================================

dash = DASH.read_text(encoding="utf-8")

if "doctorConversions:" not in dash:

    marker = """  categoryConversions: {"""

    if marker not in dash:
        raise SystemExit(
            "DashboardClient.tsx 타입 삽입 위치 못 찾음"
        )

    types = r'''
  doctorConversions: {
    doctorName: string;
    reservations: number;
    consultations: number;
    surgeries: number;
    reservationRate: number;
    consultationRate: number;
  }[];

  doctorDailyConversions: {
    date: string;
    doctorName: string;
    reservations: number;
    consultations: number;
    surgeries: number;
    reservationRate: number;
    consultationRate: number;
  }[];

'''

    dash = dash.replace(
        marker,
        types + marker,
        1
    )

    print("OK DashboardClient: 타입 추가")


# ============================================================
# 7. 상담 대비 수술전환 아래에 원장별 표 추가
# ============================================================

if "원장별 수술 전환율" not in dash:

    marker = """            <section className="mt-6">
              <PlatformDetailTable"""

    if marker not in dash:
        # whitespace 변형 대응
        marker = '<PlatformDetailTable'

        pos = dash.find(marker)

        if pos < 0:
            raise SystemExit(
                "DashboardClient.tsx PlatformDetailTable 위치 못 찾음"
            )

        section_start = dash.rfind(
            '<section className="mt-6">',
            0,
            pos
        )

        if section_start < 0:
            raise SystemExit(
                "PlatformDetailTable section 시작점 못 찾음"
            )

        insert_pos = section_start

    else:
        insert_pos = dash.find(marker)


    doctor_ui = r'''
            {/* ========================================
                원장별 수술 전환율
            ======================================== */}

            <section className="mt-6">
              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">

                <div className="flex flex-wrap items-start justify-between gap-4">

                  <div>
                    <h2 className="text-lg font-black text-zinc-900">
                      원장별 수술 전환율
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                      상담예약 · 실제 상담 · 수술결정 기준
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
                    dashboardData.doctorConversions ?? [];

                  const totalReservations =
                    rows.reduce(
                      (sum, row) =>
                        sum + row.reservations,
                      0
                    );

                  const totalConsultations =
                    rows.reduce(
                      (sum, row) =>
                        sum + row.consultations,
                      0
                    );

                  const totalSurgeries =
                    rows.reduce(
                      (sum, row) =>
                        sum + row.surgeries,
                      0
                    );

                  const totalReservationRate =
                    totalReservations > 0
                      ? (
                          totalSurgeries /
                          totalReservations
                        ) * 100
                      : 0;

                  const totalConsultationRate =
                    totalConsultations > 0
                      ? (
                          totalSurgeries /
                          totalConsultations
                        ) * 100
                      : 0;


                  return (
                    <>

                      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">

                        <div className="rounded-2xl bg-zinc-50 p-5">
                          <p className="text-xs font-bold text-zinc-500">
                            상담예약
                          </p>

                          <p className="mt-2 text-3xl font-black text-zinc-900">
                            {totalReservations.toLocaleString()}
                          </p>
                        </div>


                        <div className="rounded-2xl bg-zinc-50 p-5">
                          <p className="text-xs font-bold text-zinc-500">
                            실제 상담
                          </p>

                          <p className="mt-2 text-3xl font-black text-zinc-900">
                            {totalConsultations.toLocaleString()}
                          </p>
                        </div>


                        <div className="rounded-2xl bg-zinc-50 p-5">
                          <p className="text-xs font-bold text-zinc-500">
                            수술결정
                          </p>

                          <p className="mt-2 text-3xl font-black text-zinc-900">
                            {totalSurgeries.toLocaleString()}
                          </p>
                        </div>


                        <div className="rounded-2xl bg-zinc-50 p-5">
                          <p className="text-xs font-bold text-zinc-500">
                            예약 → 수술
                          </p>

                          <p className="mt-2 text-3xl font-black text-blue-600">
                            {totalReservationRate.toFixed(1)}%
                          </p>
                        </div>


                        <div className="rounded-2xl bg-zinc-50 p-5">
                          <p className="text-xs font-bold text-zinc-500">
                            상담 → 수술
                          </p>

                          <p className="mt-2 text-3xl font-black text-blue-600">
                            {totalConsultationRate.toFixed(1)}%
                          </p>
                        </div>

                      </div>


                      <div className="mt-6 overflow-x-auto">

                        <table className="w-full min-w-[760px] text-sm">

                          <thead>
                            <tr className="border-b border-zinc-200 text-zinc-500">

                              <th className="px-3 py-3 text-left">
                                원장
                              </th>

                              <th className="px-3 py-3 text-right">
                                상담예약
                              </th>

                              <th className="px-3 py-3 text-right">
                                실제상담
                              </th>

                              <th className="px-3 py-3 text-right">
                                수술결정
                              </th>

                              <th className="px-3 py-3 text-right">
                                예약→수술
                              </th>

                              <th className="px-3 py-3 text-right">
                                상담→수술
                              </th>

                            </tr>
                          </thead>


                          <tbody>

                            {rows.map((row) => (

                              <tr
                                key={row.doctorName}
                                className="border-b border-zinc-100"
                              >

                                <td className="px-3 py-3 font-bold text-zinc-900">
                                  {row.doctorName}
                                </td>

                                <td className="px-3 py-3 text-right">
                                  {row.reservations.toLocaleString()}
                                </td>

                                <td className="px-3 py-3 text-right">
                                  {row.consultations.toLocaleString()}
                                </td>

                                <td className="px-3 py-3 text-right font-bold">
                                  {row.surgeries.toLocaleString()}
                                </td>

                                <td className="px-3 py-3 text-right">
                                  {row.reservationRate.toFixed(1)}%
                                </td>

                                <td className="px-3 py-3 text-right font-black text-blue-600">
                                  {row.consultationRate.toFixed(1)}%
                                </td>

                              </tr>

                            ))}

                          </tbody>

                        </table>


                        {rows.length === 0 && (

                          <div className="py-10 text-center text-sm text-zinc-400">
                            원장별 상담/수술 데이터가 없습니다.
                          </div>

                        )}

                      </div>

                    </>
                  );

                })()}

              </article>
            </section>


'''

    dash = (
        dash[:insert_pos]
        + doctor_ui
        + dash[insert_pos:]
    )

    print("OK DashboardClient: 원장별 전환율 UI 추가")


DASH.write_text(
    dash,
    encoding="utf-8"
)


print("")
print("==============================================")
print(" DOCTOR CONVERSION PATCH COMPLETE")
print("==============================================")
print("1. doctor_conversion_stats 스키마 추가")
print("2. 원장별 DB 조회 추가")
print("3. 원장별 월 집계 추가")
print("4. 예약→수술 전환율 추가")
print("5. 실제상담→수술 전환율 추가")
print("6. 대시보드 원장별 상세표 추가")
print("")
print("BACKUP:", STAMP)

