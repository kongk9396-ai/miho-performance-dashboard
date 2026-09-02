import { NextRequest, NextResponse } from "next/server";
import {
  and,
  asc,
  eq,
  gte,
  lt,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  dailyConversionStats,
  doctorConversionStats,
  monthlyConversionStats,
} from "@/lib/db/schema";

import { isAdminAuthenticated } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DailyInput = {
  date: string;
  actualSurgeries: number;
  consultations: number;
  surgeries: number;
};

type DoctorInput = {
  doctorName: string;
  reservations: number;
  consultations: number;
  surgeries: number;
};

type SaveBody = {
  month: string;
  section: "daily" | "doctors";
  daily?: DailyInput[];
  doctors?: DoctorInput[];
};

function safeNumber(value: unknown) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(n)
  );
}

function normalizeMonth(value: string | null) {
  const text =
    String(value ?? "").trim();

  if (
    !/^\d{4}-\d{2}$/.test(text)
  ) {
    return null;
  }

  const [, monthText] =
    text.split("-");

  const month =
    Number(monthText);

  if (
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return text;
}

function monthBounds(month: string) {
  const [
    yearText,
    monthText,
  ] = month.split("-");

  const year =
    Number(yearText);

  const monthNumber =
    Number(monthText);

  const start =
    `${yearText}-${monthText}-01`;

  const next =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${yearText}-${String(
          monthNumber + 1
        ).padStart(2, "0")}-01`;

  return {
    start,
    next,
  };
}


/* ==========================================================
   GET
========================================================== */

export async function GET(
  request: NextRequest
) {
  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "관리자 로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const month =
      normalizeMonth(
        request.nextUrl.searchParams.get(
          "month"
        )
      );

    if (!month) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "올바른 기준월이 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      start,
      next,
    } = monthBounds(month);

    const [
      daily,
      doctors,
    ] =
      await Promise.all([
        db
          .select({
            date:
              dailyConversionStats.date,
            actualSurgeries:
              dailyConversionStats.actualSurgeries,
            consultations:
              dailyConversionStats.consultations,
            surgeries:
              dailyConversionStats.surgeries,
          })
          .from(
            dailyConversionStats
          )
          .where(
            and(
              gte(
                dailyConversionStats.date,
                start
              ),
              lt(
                dailyConversionStats.date,
                next
              )
            )
          )
          .orderBy(
            asc(
              dailyConversionStats.date
            )
          ),

        db
          .select({
            date:
              doctorConversionStats.date,
            doctorName:
              doctorConversionStats.doctorName,
            reservations:
              doctorConversionStats.reservations,
            consultations:
              doctorConversionStats.consultations,
            surgeries:
              doctorConversionStats.surgeries,
          })
          .from(
            doctorConversionStats
          )
          .where(
            and(
              gte(
                doctorConversionStats.date,
                start
              ),
              lt(
                doctorConversionStats.date,
                next
              )
            )
          )
          .orderBy(
            asc(
              doctorConversionStats.date
            )
          ),
      ]);

    return NextResponse.json({
      ok: true,
      month,
      daily: daily.map(
        (row) => ({
          ...row,
          actualSurgeries:
            Number(
              row.actualSurgeries ?? 0
            ),
        })
      ),
      doctors,
    });
  } catch (error) {
    console.error(
      "GET manual conversion error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "데이터를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


/* ==========================================================
   POST
========================================================== */

export async function POST(
  request: NextRequest
) {
  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "관리자 로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const body =
      (await request.json()) as SaveBody;

    const month =
      normalizeMonth(body.month);

    if (!month) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "올바른 기준월이 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      start,
      next,
    } = monthBounds(month);


    /* ======================================================
       일별 저장
    ====================================================== */

    if (
      body.section === "daily"
    ) {
      const rows =
        Array.isArray(body.daily)
          ? body.daily.filter(
              (row) =>
                typeof row.date ===
                  "string" &&
                row.date >= start &&
                row.date < next
            )
          : [];

      /*
       * 선택 월의 일별 자료는
       * 입력 화면 내용을 정답으로 사용.
       */
      await db
        .delete(
          dailyConversionStats
        )
        .where(
          and(
            gte(
              dailyConversionStats.date,
              start
            ),
            lt(
              dailyConversionStats.date,
              next
            )
          )
        );

      if (
        rows.length > 0
      ) {
        await db
          .insert(
            dailyConversionStats
          )
          .values(
            rows.map(
              (row) => ({
                date:
                  row.date,

                actualSurgeries:
                  safeNumber(
                    row.actualSurgeries
                  ),

                consultations:
                  safeNumber(
                    row.consultations
                  ),

                surgeries:
                  safeNumber(
                    row.surgeries
                  ),
              })
            )
          );
      }

      const totalConsultations =
        rows.reduce(
          (sum, row) =>
            sum +
            safeNumber(
              row.consultations
            ),
          0
        );

      const totalSurgeries =
        rows.reduce(
          (sum, row) =>
            sum +
            safeNumber(
              row.surgeries
            ),
          0
        );

      /*
       * 대시보드 상단 KPI도
       * 일별 입력 합계와 맞도록
       * 월간 상담/수술결정 합계 동기화.
       */
      await db
        .insert(
          monthlyConversionStats
        )
        .values({
          month: start,
          consultations:
            totalConsultations,
          surgeries:
            totalSurgeries,
        })
        .onConflictDoUpdate({
          target:
            monthlyConversionStats.month,

          set: {
            consultations:
              totalConsultations,

            surgeries:
              totalSurgeries,

            updatedAt:
              new Date(),
          },
        });

      return NextResponse.json({
        ok: true,
        message:
          "일별 상담 대비 수술 전환 데이터를 저장했습니다.",
      });
    }


    /* ======================================================
       원장별 저장
    ====================================================== */

    if (
      body.section === "doctors"
    ) {
      const rows =
        Array.isArray(
          body.doctors
        )
          ? body.doctors
          : [];

      /*
       * 선택 월 원장 데이터는
       * 관리자 입력 내용을 기준으로 교체.
       */
      await db
        .delete(
          doctorConversionStats
        )
        .where(
          and(
            gte(
              doctorConversionStats.date,
              start
            ),
            lt(
              doctorConversionStats.date,
              next
            )
          )
        );

      if (
        rows.length > 0
      ) {
        await db
          .insert(
            doctorConversionStats
          )
          .values(
            rows.map(
              (row) => ({
                /*
                 * 원장별 월 자료이므로
                 * 해당 월 1일을 대표 날짜로 저장.
                 */
                date:
                  start,

                doctorName:
                  String(
                    row.doctorName
                  ).trim(),

                reservations:
                  safeNumber(
                    row.reservations
                  ),

                consultations:
                  safeNumber(
                    row.consultations
                  ),

                surgeries:
                  safeNumber(
                    row.surgeries
                  ),
              })
            )
          );
      }

      return NextResponse.json({
        ok: true,
        message:
          "원장별 수술 전환 데이터를 저장했습니다.",
      });
    }


    return NextResponse.json(
      {
        ok: false,
        message:
          "저장 구분이 올바르지 않습니다.",
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      "POST manual conversion error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
