import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  eq,
  gte,
  inArray,
  lt,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";

import {
  adminMonthLocks,
  dailyConversionStats,
  doctorConversionStats,
  monthlyConversionStats,
} from "@/lib/db/schema";

import {
  isAdminAuthenticated,
} from "@/lib/auth/admin";

import {
  closedDaysInMonth,
  isClosedDay,
} from "@/lib/kr-holidays";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  구글 시트 상담/수술 전환 붙여넣기 저장

  1. 일별 상담/수술 → daily_conversion_stats (같은 날짜는 덮어쓰기)
  2. 원장별 월간 수치 → doctor_conversion_stats
     (해당 월 기존 원장 데이터를 지우고 월 1일자로 저장)
  3. 월간 상담/수술 합계 → monthly_conversion_stats
     (해당 월 일별 데이터 합계로 다시 계산)
*/

type DayInput = {
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

function safeNumber(value: unknown) {
  return Math.max(
    0,
    Math.round(Number(value) || 0)
  );
}

function getNextMonth(monthStart: string) {
  const [year, month] = monthStart
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month, 1)
  );

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}-01`;
}

export async function POST(
  request: NextRequest
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        ok: false,
        message: "관리자 로그인이 필요합니다.",
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const month = String(body.month ?? "");

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        {
          ok: false,
          message: "기준월(YYYY-MM)이 필요합니다.",
        },
        { status: 400 }
      );
    }

    const monthStart = `${month}-01`;
    const nextMonth = getNextMonth(monthStart);

    /*
      월 마감 확인
    */
    const [lock] = await db
      .select()
      .from(adminMonthLocks)
      .where(eq(adminMonthLocks.month, monthStart));

    if (lock?.isLocked) {
      return NextResponse.json(
        {
          ok: false,
          message: `${month}은 마감된 월이라 저장할 수 없습니다. 마감을 먼저 해제해주세요.`,
        },
        { status: 423 }
      );
    }

    /*
      일요일·공휴일은 저장하지 않는다
    */
    const days: DayInput[] = (
      Array.isArray(body.days) ? body.days : []
    ).filter(
      (day: DayInput) =>
        !isClosedDay(String(day?.date ?? ""))
    );

    const doctors: DoctorInput[] = Array.isArray(
      body.doctors
    )
      ? body.doctors
      : [];

    const outOfMonth = days.filter(
      (day) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(
          String(day.date)
        ) ||
        !String(day.date).startsWith(month)
    );

    if (outOfMonth.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `기준월(${month})과 다른 날짜가 있습니다: ${outOfMonth
            .map((day) => day.date)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (
      days.length === 0 &&
      doctors.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "저장할 데이터가 없습니다.",
        },
        { status: 400 }
      );
    }

    /*
      1. 일별 상담 / 수술
    */
    for (const day of days) {
      const values = {
        actualSurgeries: safeNumber(
          day.actualSurgeries
        ),
        consultations: safeNumber(
          day.consultations
        ),
        surgeries: safeNumber(day.surgeries),
      };

      await db
        .insert(dailyConversionStats)
        .values({
          date: day.date,
          ...values,
        })
        .onConflictDoUpdate({
          target: dailyConversionStats.date,
          set: {
            ...values,
            updatedAt: new Date(),
          },
        });
    }

    /*
      1-1. 휴무일은 기존에 들어간 값까지 0으로 정리
    */
    const closedDays = closedDaysInMonth(month);

    if (days.length > 0 && closedDays.length > 0) {
      await db
        .update(dailyConversionStats)
        .set({
          actualSurgeries: 0,
          consultations: 0,
          surgeries: 0,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            dailyConversionStats.date,
            closedDays
          )
        );
    }

    /*
      2. 원장별 (월 단위)
    */
    if (doctors.length > 0) {
      await db
        .delete(doctorConversionStats)
        .where(
          and(
            gte(
              doctorConversionStats.date,
              monthStart
            ),
            lt(
              doctorConversionStats.date,
              nextMonth
            )
          )
        );

      for (const doctor of doctors) {
        const doctorName = String(
          doctor.doctorName ?? ""
        ).trim();

        if (!doctorName) {
          continue;
        }

        await db
          .insert(doctorConversionStats)
          .values({
            date: monthStart,
            doctorName,
            reservations: safeNumber(
              doctor.reservations
            ),
            consultations: safeNumber(
              doctor.consultations
            ),
            surgeries: safeNumber(
              doctor.surgeries
            ),
          });
      }
    }

    /*
      3. 월간 상담 / 수술 합계 동기화
    */
    let monthly = null as null | {
      consultations: number;
      surgeries: number;
    };

    if (days.length > 0) {
      const [totals] = await db
        .select({
          consultations: sql<number>`coalesce(sum(${dailyConversionStats.consultations}), 0)`,
          surgeries: sql<number>`coalesce(sum(${dailyConversionStats.surgeries}), 0)`,
        })
        .from(dailyConversionStats)
        .where(
          and(
            gte(
              dailyConversionStats.date,
              monthStart
            ),
            lt(
              dailyConversionStats.date,
              nextMonth
            )
          )
        );

      monthly = {
        consultations: safeNumber(
          totals?.consultations
        ),
        surgeries: safeNumber(
          totals?.surgeries
        ),
      };

      await db
        .insert(monthlyConversionStats)
        .values({
          month: monthStart,
          ...monthly,
        })
        .onConflictDoUpdate({
          target: monthlyConversionStats.month,
          set: {
            ...monthly,
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.json({
      ok: true,
      message: `${month} 저장 완료 · 일별 ${days.length}일 · 원장 ${doctors.length}명${
        monthly
          ? ` · 월 합계 상담 ${monthly.consultations} / 수술결정 ${monthly.surgeries}`
          : ""
      }`,
    });
  } catch (error) {
    console.error(
      "Conversion paste commit error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message: "저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}