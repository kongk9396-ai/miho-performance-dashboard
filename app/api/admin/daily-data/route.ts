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

import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";

import {
  adminMonthLocks,
  dailyCallStats,
  dailyCancellations,
  dailyCategoryConversionStats,
  dailyConversionStats,
  dailyIncallStats,
  dailyPlatformStats,
  dailyReports,
  dailyVisitSources,
  doctorConversionStats,
  monthlyConversionStats,
  monthlyPlatformStats,
} from "@/lib/db/schema";

import {
  isAdminAuthenticated,
} from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  날짜별 데이터 조회 / 삭제

  - GET  ?month=YYYY-MM
    해당 월에 저장된 날짜별 데이터 현황

  - DELETE { dates: ["YYYY-MM-DD"], groups: ["report", "conversion"] }
    report     : 텔레그램 DB보고 (플랫폼 실적, 원문, 전날콜/7콜, 내원경로, 총인콜, 당취)
    conversion : 상담·수술 전환 (일별 전환, 부위별 전환, 원장별 전환)

  삭제 후 해당 월의 월간 합계는 남은 일별 데이터 기준으로 다시 계산한다.
*/

type Group =
  | "report"
  | "conversion";

type DaySummary = {
  date: string;

  hasReport: boolean;
  applications: number;
  reservations: number;
  platformRows: number;
  callRows: number;
  visitSourceRows: number;
  incallTotal: number;
  cancellationRows: number;

  hasConversion: boolean;
  consultations: number;
  surgeries: number;
  categoryRows: number;
  doctorRows: number;
};

function unauthorized() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "관리자 로그인이 필요합니다.",
    },
    { status: 401 }
  );
}

function isValidDate(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  );
}

function getMonthStart(
  date: string
) {
  return `${date.slice(0, 7)}-01`;
}

function getNextMonth(
  monthStart: string
) {
  const [year, monthNumber] =
    monthStart
      .split("-")
      .map(Number);

  const date = new Date(
    year,
    monthNumber,
    1
  );

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-01`;
}

function toNumber(
  value: unknown
) {
  return Math.max(
    0,
    Math.round(Number(value) || 0)
  );
}

function dateKey(
  value: unknown
) {
  return String(value).slice(0, 10);
}

/*
  월간 플랫폼 실적 = 남은 일별 플랫폼 실적 합계
  (paste/commit 의 rebuildMonthlyPlatformStats 와 동일한 방식)
*/
async function rebuildMonthlyPlatformStats(
  monthStart: string
) {
  const nextMonth =
    getNextMonth(monthStart);

  const totals = await db
    .select({
      platformId:
        dailyPlatformStats.platformId,
      applications: sql<number>`coalesce(sum(${dailyPlatformStats.applications}), 0)`,
      reservations: sql<number>`coalesce(sum(${dailyPlatformStats.reservations}), 0)`,
    })
    .from(dailyPlatformStats)
    .where(
      and(
        gte(
          dailyPlatformStats.date,
          monthStart
        ),
        lt(
          dailyPlatformStats.date,
          nextMonth
        )
      )
    )
    .groupBy(
      dailyPlatformStats.platformId
    );

  await db
    .delete(monthlyPlatformStats)
    .where(
      eq(
        monthlyPlatformStats.month,
        monthStart
      )
    );

  if (totals.length > 0) {
    await db
      .insert(monthlyPlatformStats)
      .values(
        totals.map((row) => ({
          month: monthStart,
          platformId: row.platformId,
          applications: toNumber(
            row.applications
          ),
          reservations: toNumber(
            row.reservations
          ),
        }))
      );
  }
}

/*
  월간 상담/수술 = 남은 일별 전환 합계
  (conversion-paste/commit, conversion/manual 과 동일한 방식)
*/
async function rebuildMonthlyConversionStats(
  monthStart: string
) {
  const nextMonth =
    getNextMonth(monthStart);

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

  const monthly = {
    consultations: toNumber(
      totals?.consultations
    ),
    surgeries: toNumber(
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
      target:
        monthlyConversionStats.month,
      set: {
        ...monthly,
        updatedAt: new Date(),
      },
    });
}

export async function GET(
  request: NextRequest
) {
  if (
    !(await isAdminAuthenticated())
  ) {
    return unauthorized();
  }

  try {
    const month =
      request.nextUrl.searchParams.get(
        "month"
      ) ?? "";

    if (
      !/^\d{4}-\d{2}$/.test(month)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "기준월(YYYY-MM)이 필요합니다.",
        },
        { status: 400 }
      );
    }

    const start = `${month}-01`;
    const next = getNextMonth(start);

    const range = (
      column: AnyPgColumn
    ) =>
      and(
        gte(column, start),
        lt(column, next)
      );

    const [
      platformRows,
      reportRows,
      callRows,
      visitRows,
      incallRows,
      cancelRows,
      conversionRows,
      categoryRows,
      doctorRows,
      lockRows,
    ] = await Promise.all([
      db
        .select({
          date: dailyPlatformStats.date,
          rows: sql<number>`count(*)`,
          applications: sql<number>`coalesce(sum(${dailyPlatformStats.applications}), 0)`,
          reservations: sql<number>`coalesce(sum(${dailyPlatformStats.reservations}), 0)`,
        })
        .from(dailyPlatformStats)
        .where(
          range(dailyPlatformStats.date)
        )
        .groupBy(
          dailyPlatformStats.date
        ),

      db
        .select({
          date: dailyReports.date,
        })
        .from(dailyReports)
        .where(
          range(dailyReports.date)
        ),

      db
        .select({
          date: dailyCallStats.date,
          rows: sql<number>`count(*)`,
        })
        .from(dailyCallStats)
        .where(
          range(dailyCallStats.date)
        )
        .groupBy(dailyCallStats.date),

      db
        .select({
          date: dailyVisitSources.date,
          rows: sql<number>`count(*)`,
        })
        .from(dailyVisitSources)
        .where(
          range(dailyVisitSources.date)
        )
        .groupBy(
          dailyVisitSources.date
        ),

      db
        .select({
          date: dailyIncallStats.date,
          total: sql<number>`coalesce(sum(${dailyIncallStats.total}), 0)`,
        })
        .from(dailyIncallStats)
        .where(
          range(dailyIncallStats.date)
        )
        .groupBy(
          dailyIncallStats.date
        ),

      db
        .select({
          date: dailyCancellations.date,
          rows: sql<number>`count(*)`,
        })
        .from(dailyCancellations)
        .where(
          range(dailyCancellations.date)
        )
        .groupBy(
          dailyCancellations.date
        ),

      db
        .select({
          date: dailyConversionStats.date,
          consultations:
            dailyConversionStats.consultations,
          surgeries:
            dailyConversionStats.surgeries,
        })
        .from(dailyConversionStats)
        .where(
          range(
            dailyConversionStats.date
          )
        ),

      db
        .select({
          date: dailyCategoryConversionStats.date,
          rows: sql<number>`count(*)`,
        })
        .from(
          dailyCategoryConversionStats
        )
        .where(
          range(
            dailyCategoryConversionStats.date
          )
        )
        .groupBy(
          dailyCategoryConversionStats.date
        ),

      db
        .select({
          date: doctorConversionStats.date,
          rows: sql<number>`count(*)`,
        })
        .from(doctorConversionStats)
        .where(
          range(
            doctorConversionStats.date
          )
        )
        .groupBy(
          doctorConversionStats.date
        ),

      db
        .select()
        .from(adminMonthLocks)
        .where(
          eq(adminMonthLocks.month, start)
        ),
    ]);

    const map = new Map<
      string,
      DaySummary
    >();

    const get = (raw: unknown) => {
      const date = dateKey(raw);

      let row = map.get(date);

      if (!row) {
        row = {
          date,
          hasReport: false,
          applications: 0,
          reservations: 0,
          platformRows: 0,
          callRows: 0,
          visitSourceRows: 0,
          incallTotal: 0,
          cancellationRows: 0,
          hasConversion: false,
          consultations: 0,
          surgeries: 0,
          categoryRows: 0,
          doctorRows: 0,
        };

        map.set(date, row);
      }

      return row;
    };

    for (const r of platformRows) {
      const row = get(r.date);
      row.hasReport = true;
      row.platformRows = toNumber(r.rows);
      row.applications = toNumber(
        r.applications
      );
      row.reservations = toNumber(
        r.reservations
      );
    }

    for (const r of reportRows) {
      get(r.date).hasReport = true;
    }

    for (const r of callRows) {
      const row = get(r.date);
      row.hasReport = true;
      row.callRows = toNumber(r.rows);
    }

    for (const r of visitRows) {
      const row = get(r.date);
      row.hasReport = true;
      row.visitSourceRows = toNumber(
        r.rows
      );
    }

    for (const r of incallRows) {
      const row = get(r.date);
      row.hasReport = true;
      row.incallTotal = toNumber(
        r.total
      );
    }

    for (const r of cancelRows) {
      const row = get(r.date);
      row.hasReport = true;
      row.cancellationRows = toNumber(
        r.rows
      );
    }

    for (const r of conversionRows) {
      const row = get(r.date);
      row.hasConversion = true;
      row.consultations = toNumber(
        r.consultations
      );
      row.surgeries = toNumber(
        r.surgeries
      );
    }

    for (const r of categoryRows) {
      const row = get(r.date);
      row.hasConversion = true;
      row.categoryRows = toNumber(
        r.rows
      );
    }

    for (const r of doctorRows) {
      const row = get(r.date);
      row.hasConversion = true;
      row.doctorRows = toNumber(r.rows);
    }

    const days = [...map.values()].sort(
      (a, b) =>
        a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      ok: true,
      month,
      locked: Boolean(
        lockRows[0]?.isLocked
      ),
      days,
    });
  } catch (error) {
    console.error(
      "[daily-data GET]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "날짜별 데이터를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  if (
    !(await isAdminAuthenticated())
  ) {
    return unauthorized();
  }

  try {
    const body =
      (await request.json()) as {
        dates?: unknown;
        groups?: unknown;
      };

    const dates = [
      ...new Set(
        (Array.isArray(body.dates)
          ? body.dates
          : []
        ).filter(isValidDate)
      ),
    ].sort();

    const groups = new Set<Group>(
      (Array.isArray(body.groups)
        ? body.groups
        : []
      ).filter(
        (g): g is Group =>
          g === "report" ||
          g === "conversion"
      )
    );

    if (dates.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "삭제할 날짜를 선택해주세요.",
        },
        { status: 400 }
      );
    }

    if (groups.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "삭제할 데이터 종류를 선택해주세요.",
        },
        { status: 400 }
      );
    }

    const months = [
      ...new Set(
        dates.map(getMonthStart)
      ),
    ];

    /*
      마감된 월은 삭제 불가
    */
    const locks = await db
      .select()
      .from(adminMonthLocks)
      .where(
        inArray(
          adminMonthLocks.month,
          months
        )
      );

    const lockedMonths = locks
      .filter((row) => row.isLocked)
      .map((row) =>
        dateKey(row.month).slice(0, 7)
      );

    if (lockedMonths.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `${lockedMonths.join(
            ", "
          )}은 마감된 월이라 삭제할 수 없습니다. 마감을 먼저 해제해주세요.`,
        },
        { status: 423 }
      );
    }

    if (groups.has("report")) {
      await db
        .delete(dailyPlatformStats)
        .where(
          inArray(
            dailyPlatformStats.date,
            dates
          )
        );

      await db
        .delete(dailyCallStats)
        .where(
          inArray(
            dailyCallStats.date,
            dates
          )
        );

      await db
        .delete(dailyVisitSources)
        .where(
          inArray(
            dailyVisitSources.date,
            dates
          )
        );

      await db
        .delete(dailyIncallStats)
        .where(
          inArray(
            dailyIncallStats.date,
            dates
          )
        );

      await db
        .delete(dailyCancellations)
        .where(
          inArray(
            dailyCancellations.date,
            dates
          )
        );

      await db
        .delete(dailyReports)
        .where(
          inArray(
            dailyReports.date,
            dates
          )
        );
    }

    if (groups.has("conversion")) {
      await db
        .delete(dailyConversionStats)
        .where(
          inArray(
            dailyConversionStats.date,
            dates
          )
        );

      await db
        .delete(
          dailyCategoryConversionStats
        )
        .where(
          inArray(
            dailyCategoryConversionStats.date,
            dates
          )
        );

      await db
        .delete(doctorConversionStats)
        .where(
          inArray(
            doctorConversionStats.date,
            dates
          )
        );
    }

    for (const monthStart of months) {
      if (groups.has("report")) {
        await rebuildMonthlyPlatformStats(
          monthStart
        );
      }

      if (groups.has("conversion")) {
        await rebuildMonthlyConversionStats(
          monthStart
        );
      }
    }

    const groupLabel = [
      groups.has("report")
        ? "DB보고"
        : null,
      groups.has("conversion")
        ? "상담·수술 전환"
        : null,
    ]
      .filter(Boolean)
      .join(" + ");

    return NextResponse.json({
      ok: true,
      message: `${dates.length}일치 ${groupLabel} 데이터를 삭제했고 월간 합계를 다시 계산했습니다.`,
      deletedDates: dates,
      rebuiltMonths: months.map((m) =>
        m.slice(0, 7)
      ),
    });
  } catch (error) {
    console.error(
      "[daily-data DELETE]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
