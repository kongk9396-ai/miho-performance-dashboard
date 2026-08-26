import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  asc,
  eq,
  gte,
  lt,
} from "drizzle-orm";

import { db } from "@/lib/db";

import {
  dailyCallStats,
  dailyCancellations,
  dailyIncallStats,
  dailyPlatformStats,
  dailyVisitSources,
  platforms,
} from "@/lib/db/schema";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

/*
=========================================
기준월 시작일 / 다음달 시작일
=========================================
*/

function getMonthRange(
  month: string
) {
  const [year, monthNumber] =
    month
      .split("-")
      .map(Number);

  const start =
    `${year}-${String(
      monthNumber
    ).padStart(2, "0")}-01`;

  const nextDate =
    new Date(
      Date.UTC(
        year,
        monthNumber,
        1
      )
    );

  const next =
    `${nextDate.getUTCFullYear()}-${String(
      nextDate.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    )}-01`;

  return {
    start,
    next,
  };
}

/*
=========================================
GET
일별 대시보드 데이터
=========================================
*/

export async function GET(
  request: NextRequest
) {
  try {
    const month =
      request.nextUrl.searchParams.get(
        "month"
      );

    if (!month) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "기준월이 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      start,
      next,
    } =
      getMonthRange(
        month
      );

    /*
    =========================================
    데이터 조회

    platformRows에서 플랫폼 설정까지
    함께 가져온다.

    includeInTotal
      → KPI 합계 포함 여부

    includeInChannelChart
      → 채널 목록/차트 표시 여부

    isActive
      → 현재 활성 상태
      ※ 과거 데이터 자체는 삭제/제외하지 않음
    =========================================
    */

    const [
      platformRows,
      callRows,
      visitRows,
      incallRows,
      cancellationRows,
    ] = await Promise.all([
      db
        .select({
          date:
            dailyPlatformStats.date,

          platformId:
            platforms.id,

          platform:
            platforms.name,

          applications:
            dailyPlatformStats.applications,

          reservations:
            dailyPlatformStats.reservations,

          sortOrder:
            platforms.sortOrder,

          isActive:
            platforms.isActive,

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
              start
            ),
            lt(
              dailyPlatformStats.date,
              next
            )
          )
        )
        .orderBy(
          asc(
            dailyPlatformStats.date
          ),
          asc(
            platforms.sortOrder
          ),
          asc(
            platforms.id
          )
        ),

      /*
      =========================================
      전날콜 / 7콜
      =========================================
      */

      db
        .select()
        .from(
          dailyCallStats
        )
        .where(
          and(
            gte(
              dailyCallStats.date,
              start
            ),
            lt(
              dailyCallStats.date,
              next
            )
          )
        )
        .orderBy(
          asc(
            dailyCallStats.date
          )
        ),

      /*
      =========================================
      내원경로
      =========================================
      */

      db
        .select()
        .from(
          dailyVisitSources
        )
        .where(
          and(
            gte(
              dailyVisitSources.date,
              start
            ),
            lt(
              dailyVisitSources.date,
              next
            )
          )
        )
        .orderBy(
          asc(
            dailyVisitSources.date
          )
        ),

      /*
      =========================================
      총인콜
      =========================================
      */

      db
        .select()
        .from(
          dailyIncallStats
        )
        .where(
          and(
            gte(
              dailyIncallStats.date,
              start
            ),
            lt(
              dailyIncallStats.date,
              next
            )
          )
        )
        .orderBy(
          asc(
            dailyIncallStats.date
          )
        ),

      /*
      =========================================
      당일취소

      일반 대시보드에서는
      개인정보 없이 건수만 조회
      =========================================
      */

      db
        .select({
          date:
            dailyCancellations.date,
        })
        .from(
          dailyCancellations
        )
        .where(
          and(
            gte(
              dailyCancellations.date,
              start
            ),
            lt(
              dailyCancellations.date,
              next
            )
          )
        ),
    ]);

    /*
    =========================================
    데이터가 존재하는 날짜 생성
    =========================================
    */

    const dates =
      Array.from(
        new Set([
          ...platformRows.map(
            (row) =>
              row.date
          ),

          ...callRows.map(
            (row) =>
              row.date
          ),

          ...visitRows.map(
            (row) =>
              row.date
          ),

          ...incallRows.map(
            (row) =>
              row.date
          ),

          ...cancellationRows.map(
            (row) =>
              row.date
          ),
        ])
      ).sort();

    /*
    =========================================
    날짜별 데이터 조립
    =========================================
    */

    const days =
      dates.map(
        (date) => {
          /*
          해당 날짜 플랫폼 전체

          비활성 플랫폼이라도
          과거 데이터가 존재하면 여기에는 남는다.
          */

          const dayPlatforms =
            platformRows.filter(
              (row) =>
                row.date ===
                date
            );

          /*
          =====================================
          KPI 합계 대상

          includeInTotal=true만 합산
          =====================================
          */

          const totalPlatforms =
            dayPlatforms.filter(
              (row) =>
                row.includeInTotal
            );

          /*
          =====================================
          채널 목록/차트 대상

          includeInChannelChart=true만 노출
          =====================================
          */

          const chartPlatforms =
            dayPlatforms.filter(
              (row) =>
                row.includeInChannelChart
            );

          /*
          =====================================
          신청 합계
          =====================================
          */

          const applications =
            totalPlatforms.reduce(
              (sum, row) =>
                sum +
                row.applications,
              0
            );

          /*
          =====================================
          예약 합계
          =====================================
          */

          const reservations =
            totalPlatforms.reduce(
              (sum, row) =>
                sum +
                row.reservations,
              0
            );

          /*
          =====================================
          콜 데이터
          =====================================
          */

          const call =
            callRows.find(
              (row) =>
                row.date ===
                date
            );

          /*
          =====================================
          인콜 데이터
          =====================================
          */

          const incall =
            incallRows.find(
              (row) =>
                row.date ===
                date
            );

          /*
          =====================================
          내원경로
          =====================================
          */

          const visitSources =
            visitRows
              .filter(
                (row) =>
                  row.date ===
                  date
              )
              .map(
                (row) => ({
                  source:
                    row.source,

                  count:
                    row.count,
                })
              );

          /*
          =====================================
          당일취소 건수
          =====================================
          */

          const cancellationCount =
            cancellationRows.filter(
              (row) =>
                row.date ===
                date
            ).length;

          /*
          =====================================
          날짜 데이터 반환
          =====================================
          */

          return {
            date,

            /*
            KPI
            */

            applications,

            reservations,

            rate:
              applications > 0
                ? (reservations /
                    applications) *
                  100
                : 0,

            /*
            채널별 실적

            includeInChannelChart=true만 반환
            */

            platforms:
              chartPlatforms.map(
                (row) => ({
                  id:
                    row.platformId,

                  name:
                    row.platform,

                  applications:
                    row.applications,

                  reservations:
                    row.reservations,

                  rate:
                    row.applications >
                    0
                      ? (row.reservations /
                          row.applications) *
                        100
                      : 0,

                  isActive:
                    row.isActive,

                  includeInTotal:
                    row.includeInTotal,

                  includeInChannelChart:
                    row.includeInChannelChart,
                })
              ),

            /*
            전날콜
            */

            previousCall: {
              total:
                call?.previousTotal ??
                0,

              details:
                call?.previousDetails ??
                {},
            },

            /*
            7콜
            */

            sevenCall: {
              total:
                call?.sevenTotal ??
                0,

              details:
                call?.sevenDetails ??
                {},
            },

            /*
            내원경로
            */

            visitSources,

            /*
            인콜
            */

            incall: {
              total:
                incall?.total ??
                0,

              newCount:
                incall?.newCount ??
                0,

              simpleCount:
                incall?.simpleCount ??
                0,

              changedCount:
                incall?.changedCount ??
                0,

              canceledCount:
                incall?.canceledCount ??
                0,
            },

            /*
            당일취소
            */

            cancellationCount,
          };
        }
      );

    /*
    =========================================
    월 누적 KPI

    각 날짜에서 이미
    includeInTotal=true만 계산됐으므로
    그대로 합산하면 된다.
    =========================================
    */

    const totalApplications =
      days.reduce(
        (sum, day) =>
          sum +
          day.applications,
        0
      );

    const totalReservations =
      days.reduce(
        (sum, day) =>
          sum +
          day.reservations,
        0
      );

    const totalIncall =
      days.reduce(
        (sum, day) =>
          sum +
          day.incall.total,
        0
      );

    const totalNewIncall =
      days.reduce(
        (sum, day) =>
          sum +
          day.incall.newCount,
        0
      );

    const totalCancellations =
      days.reduce(
        (sum, day) =>
          sum +
          day.cancellationCount,
        0
      );

    /*
    =========================================
    응답
    =========================================
    */

    return NextResponse.json({
      ok: true,

      data: {
        month,

        summary: {
          applications:
            totalApplications,

          reservations:
            totalReservations,

          rate:
            totalApplications >
            0
              ? (totalReservations /
                  totalApplications) *
                100
              : 0,

          incall:
            totalIncall,

          newIncall:
            totalNewIncall,

          cancellations:
            totalCancellations,
        },

        /*
        최근 날짜가 위로 오도록 역순
        */

        days:
          [...days].reverse(),
      },
    });
  } catch (error) {
    console.error(
      "Daily API error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "일별 데이터를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}