import {
  and,
  asc,
  eq,
  gte,
  lt,
  lte,
} from "drizzle-orm";

import { db } from "./index";

import {
  dailyCategoryConversionStats,
  dailyConversionStats,
  dailyPlatformStats,
  dailyVisitSources,
  monthlyConversionStats,
  monthlyPlatformStats,
  platforms,
} from "./schema";

/* ========================================
   날짜 유틸
======================================== */

function shiftMonth(
  month: string,
  offset: number
) {
  const [year, monthNumber] =
    month
      .split("-")
      .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      monthNumber - 1 + offset,
      1
    )
  );

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}-01`;
}

function monthFromDate(
  date: string
) {
  return `${date.slice(0, 7)}-01`;
}

/*
  선택월 기준 DB 조회 범위

  예:
  selectedMonth = 2026-04-01

  start = 2025-04-01
  next  = 2026-05-01

  즉:
  >= 2025-04-01
  <  2026-05-01

  4월 31일 같은 잘못된 날짜가
  절대 만들어지지 않음.
*/
function getDashboardDateRange(
  selectedMonth: string
) {
  const start =
    shiftMonth(
      selectedMonth,
      -12
    );

  const next =
    shiftMonth(
      selectedMonth,
      1
    );

  return {
    start,
    next,
  };
}

/* ========================================
   타입
======================================== */

type PlatformDbRow = {
  month: string;

  applications: number;
  reservations: number;

  platformName: string;

  sortOrder: number;

  includeInTotal: boolean;
  includeInChannelChart: boolean;
};

type ConversionDbRow = {
  month: string;

  consultations: number;
  surgeries: number;
};

/* ========================================
   월별 플랫폼 데이터 결정

   일별 데이터가 존재하는 월:
   → 일별 합계 우선

   일별 데이터가 없는 과거 월:
   → 기존 monthly 테이블 사용
======================================== */

function getEffectivePlatformRows(
  month: string,
  monthlyRows: PlatformDbRow[],
  dailyRows: PlatformDbRow[]
) {
  const dayRows =
    dailyRows.filter(
      (row) =>
        row.month === month
    );

  /*
    일별 데이터가 없으면
    기존 월간 데이터 그대로 사용
  */
  if (
    dayRows.length === 0
  ) {
    return monthlyRows.filter(
      (row) =>
        row.month === month
    );
  }

  /*
    일별 데이터가 있으면
    플랫폼별 합산
  */

  const grouped =
    new Map<
      string,
      PlatformDbRow
    >();

  for (const row of dayRows) {
    const existing =
      grouped.get(
        row.platformName
      );

    if (existing) {
      existing.applications +=
        row.applications;

      existing.reservations +=
        row.reservations;
    } else {
      grouped.set(
        row.platformName,
        {
          ...row,
        }
      );
    }
  }

  return Array.from(
    grouped.values()
  );
}

/* ========================================
   월 데이터 생성
======================================== */

function buildMonthData(
  month: string,
  monthlyRows: PlatformDbRow[],
  dailyRows: PlatformDbRow[],
  conversionRows: ConversionDbRow[]
) {
  const platformRows =
    getEffectivePlatformRows(
      month,
      monthlyRows,
      dailyRows
    );

  const conversion =
    conversionRows.find(
      (row) =>
        row.month === month
    );

  if (
    platformRows.length === 0 &&
    !conversion
  ) {
    return null;
  }

  /*
    전체 합계 포함 플랫폼만
    신청/예약 총합 계산
  */

  const totalRows =
    platformRows.filter(
      (row) =>
        row.includeInTotal
    );

  const totalApplications =
    totalRows.reduce(
      (sum, row) =>
        sum +
        row.applications,
      0
    );

  const totalReservations =
    totalRows.reduce(
      (sum, row) =>
        sum +
        row.reservations,
      0
    );

  const reservationRate =
    totalApplications > 0
      ? (totalReservations /
          totalApplications) *
        100
      : 0;

  /*
    상담/수술은 아직
    월간 데이터 사용
  */

  const consultations =
    conversion?.consultations ??
    0;

  const surgeries =
    conversion?.surgeries ??
    0;

  const surgeryRate =
    consultations > 0
      ? (surgeries /
          consultations) *
        100
      : 0;

  /*
    플랫폼별 전환율 차트
  */

  const platformStats =
    platformRows
      .filter(
        (row) =>
          row.includeInChannelChart
      )
      .map((row) => ({
        name:
          row.platformName,

        applications:
          row.applications,

        reservations:
          row.reservations,

        rate:
          row.applications > 0
            ? (row.reservations /
                row.applications) *
              100
            : 0,

        sortOrder:
          row.sortOrder,
      }))
      .sort(
        (a, b) => {
          /*
            전환율 높은 순
          */
          if (
            b.rate !==
            a.rate
          ) {
            return (
              b.rate -
              a.rate
            );
          }

          return (
            a.sortOrder -
            b.sortOrder
          );
        }
      )
      .map(
        ({
          sortOrder: _,
          ...row
        }) => row
      );

  return {
    month,

    totalApplications,
    totalReservations,
    reservationRate,

    consultations,
    surgeries,
    surgeryRate,

    platformStats,
  };
}

/* ========================================
   메인 대시보드 조회
======================================== */

export async function getDashboardData(
  month: string
) {
  const previousMonth =
    shiftMonth(
      month,
      -1
    );

  const lastYearMonth =
    shiftMonth(
      month,
      -12
    );

  /*
    조회 시작:
    선택 월 12개월 전

    조회 끝:
    선택 월 다음달 1일 미만
  */

  const {
    start:
      queryStartDate,

    next:
      queryNextDate,
  } =
    getDashboardDateRange(
      month
    );

  /*
    월간 테이블은 month 컬럼이라
    선택월까지 조회
  */

  const queryStartMonth =
    shiftMonth(
      month,
      -12
    );

  const [
    monthlyRows,
    rawDailyRows,
    conversionRows,
    dailyConversionRows,
    categoryConversionRows,
    visitSourceRows,
  ] =
    await Promise.all([
      /* ============================
         기존 월간 플랫폼 데이터
      ============================ */

      db
        .select({
          month:
            monthlyPlatformStats.month,

          applications:
            monthlyPlatformStats.applications,

          reservations:
            monthlyPlatformStats.reservations,

          platformName:
            platforms.name,

          sortOrder:
            platforms.sortOrder,

          includeInTotal:
            platforms.includeInTotal,

          includeInChannelChart:
            platforms.includeInChannelChart,
        })
        .from(
          monthlyPlatformStats
        )
        .innerJoin(
          platforms,
          eq(
            monthlyPlatformStats.platformId,
            platforms.id
          )
        )
        .where(
          and(
            gte(
              monthlyPlatformStats.month,
              queryStartMonth
            ),

            lte(
              monthlyPlatformStats.month,
              month
            )
          )
        )
        .orderBy(
          asc(
            monthlyPlatformStats.month
          )
        ),

      /* ============================
         일별 플랫폼 원본

         ★ 여기 날짜 범위 수정됨
      ============================ */

      db
        .select({
          date:
            dailyPlatformStats.date,

          applications:
            dailyPlatformStats.applications,

          reservations:
            dailyPlatformStats.reservations,

          platformName:
            platforms.name,

          sortOrder:
            platforms.sortOrder,

          includeInTotal:
            platforms.includeInTotal,

          includeInChannelChart:
            platforms.includeInChannelChart,
        })
        .from(
          dailyPlatformStats
        )
        .innerJoin(
          platforms,
          eq(
            dailyPlatformStats.platformId,
            platforms.id
          )
        )
        .where(
          and(
            gte(
              dailyPlatformStats.date,
              queryStartDate
            ),

            lt(
              dailyPlatformStats.date,
              queryNextDate
            )
          )
        )
        .orderBy(
          asc(
            dailyPlatformStats.date
          )
        ),

      /* ============================
         상담 / 수술
      ============================ */

      db
        .select({
          month:
            monthlyConversionStats.month,

          consultations:
            monthlyConversionStats.consultations,

          surgeries:
            monthlyConversionStats.surgeries,
        })
        .from(
          monthlyConversionStats
        )
        .where(
          and(
            gte(
              monthlyConversionStats.month,
              queryStartMonth
            ),

            lte(
              monthlyConversionStats.month,
              month
            )
          )
        )
        .orderBy(
          asc(
            monthlyConversionStats.month
          )
        ),

      db
        .select({
          date: dailyConversionStats.date,
          consultations: dailyConversionStats.consultations,
          surgeries: dailyConversionStats.surgeries,
        })
        .from(dailyConversionStats)
        .where(
          and(
            gte(dailyConversionStats.date, queryStartDate),
            lt(dailyConversionStats.date, queryNextDate)
          )
        )
        .orderBy(
          asc(dailyConversionStats.date)
        ),
      db
        .select({
          date: dailyCategoryConversionStats.date,
          category: dailyCategoryConversionStats.category,
          consultations: dailyCategoryConversionStats.consultations,
          surgeries: dailyCategoryConversionStats.surgeries,
        })
        .from(dailyCategoryConversionStats)
        .where(
          and(
            gte(dailyCategoryConversionStats.date, queryStartDate),
            lt(dailyCategoryConversionStats.date, queryNextDate)
          )
        )
        .orderBy(
          asc(dailyCategoryConversionStats.date)
        ),
      db
        .select({
          date: dailyVisitSources.date,
          source: dailyVisitSources.source,
          count: dailyVisitSources.count,
        })
        .from(dailyVisitSources)
        .where(
          and(
            gte(dailyVisitSources.date, queryStartDate),
            lt(dailyVisitSources.date, queryNextDate)
          )
        ),
    ]);

  /*
    daily:

    2026-08-01
    2026-08-03
    ...

    ↓

    month = 2026-08-01

    형태로 변환
  */

  const dailyRows: PlatformDbRow[] =
    rawDailyRows.map(
      (row) => ({
        month:
          monthFromDate(
            row.date
          ),

        applications:
          row.applications,

        reservations:
          row.reservations,

        platformName:
          row.platformName,

        sortOrder:
          row.sortOrder,

        includeInTotal:
          row.includeInTotal,

        includeInChannelChart:
          row.includeInChannelChart,
      })
    );

  /*
    현재월
  */

  const current =
    buildMonthData(
      month,
      monthlyRows,
      dailyRows,
      conversionRows
    );

  /*
    전월
  */

  const previous =
    buildMonthData(
      previousMonth,
      monthlyRows,
      dailyRows,
      conversionRows
    );

  /*
    전년 동월
  */

  const lastYear =
    buildMonthData(
      lastYearMonth,
      monthlyRows,
      dailyRows,
      conversionRows
    );

  /* ========================================
     최근 12개월 추이
  ======================================== */

  const trendStart =
    shiftMonth(
      month,
      -11
    );

  const trendMonths =
    Array.from(
      new Set([
        ...monthlyRows.map(
          (row) =>
            row.month
        ),

        ...dailyRows.map(
          (row) =>
            row.month
        ),

        ...conversionRows.map(
          (row) =>
            row.month
        ),
      ])
    )
      .filter(
        (trendMonth) =>
          trendMonth >=
            trendStart &&
          trendMonth <=
            month
      )
      .sort();

  const monthlyTrend =
    trendMonths.map(
      (trendMonth) => {
        const monthData =
          buildMonthData(
            trendMonth,
            monthlyRows,
            dailyRows,
            conversionRows
          );

        return {
          month:
            trendMonth,

          applications:
            monthData
              ?.totalApplications ??
            0,

          reservations:
            monthData
              ?.totalReservations ??
            0,

          consultations:
            monthData
              ?.consultations ??
            0,

          surgeries:
            monthData
              ?.surgeries ??
            0,
        };
      }
    );

  const visitSourceMap =
    new Map<string, number>();

  visitSourceRows
    .filter(
      (row) =>
        monthFromDate(row.date) ===
        month
    )
    .forEach((row) => {
      visitSourceMap.set(
        row.source,
        (visitSourceMap.get(row.source) ?? 0) +
          row.count
      );
    });

  const monthlyVisitSources =
    Array.from(
      visitSourceMap.entries()
    )
      .map(([source, count]) => ({
        source,
        count,
      }))
      .sort(
        (a, b) =>
          b.count - a.count
      );

  const totalVisitSourceCount =
    monthlyVisitSources.reduce(
      (sum, row) =>
        sum + row.count,
      0
    );
  const dailyConversions =
    dailyConversionRows
      .filter(
        (row) =>
          monthFromDate(row.date) === month
      )
      .map((row) => ({
        date: row.date,
        consultations: row.consultations,
        surgeries: row.surgeries,
        rate:
          row.consultations > 0
            ? (row.surgeries / row.consultations) * 100
            : 0,
      }))
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      );
  const categoryNames = [
    "코",
    "눈",
    "리프팅",
    "쁘띠",
  ];

  function buildCategoryConversions(
    targetMonth: string
  ) {
    return categoryNames.map(
      (category) => {
        const rows =
          categoryConversionRows.filter(
            (row) =>
              monthFromDate(
                row.date
              ) ===
                targetMonth &&
              row.category ===
                category
          );

        const consultations =
          rows.reduce(
            (sum, row) =>
              sum +
              row.consultations,
            0
          );

        const surgeries =
          rows.reduce(
            (sum, row) =>
              sum +
              row.surgeries,
            0
          );

        const rate =
          consultations > 0
            ? (surgeries /
                consultations) *
              100
            : 0;

        return {
          category,
          consultations,
          surgeries,
          rate,
        };
      }
    );
  }

  const categoryConversions =
    buildCategoryConversions(
      month
    );

  const previousCategoryConversions =
    buildCategoryConversions(
      previousMonth
    );

  return {
    selectedMonth:
      month,

    current,
    previous,
    lastYear,

    monthlyTrend,

    monthlyVisitSources,
    totalVisitSourceCount,
    dailyConversions,
    categoryConversions,
    previousCategoryConversions,
  };
}

/* ========================================
   선택 가능한 월 목록
======================================== */

export async function getAvailableMonths() {
  const [
    monthlyRows,
    dailyRows,
    conversionRows,
  ] =
    await Promise.all([
      /*
        기존 월간
      */

      db
        .select({
          month:
            monthlyPlatformStats.month,
        })
        .from(
          monthlyPlatformStats
        ),

      /*
        일별 데이터 월
      */

      db
        .select({
          date:
            dailyPlatformStats.date,
        })
        .from(
          dailyPlatformStats
        ),

      /*
        상담/수술 월
      */

      db
        .select({
          month:
            monthlyConversionStats.month,
        })
        .from(
          monthlyConversionStats
        ),
    ]);

  return Array.from(
    new Set([
      ...monthlyRows.map(
        (row) =>
          row.month
      ),

      ...dailyRows.map(
        (row) =>
          monthFromDate(
            row.date
          )
      ),

      ...conversionRows.map(
        (row) =>
          row.month
      ),
    ])
  ).sort(
    (a, b) =>
      b.localeCompare(a)
  );
}