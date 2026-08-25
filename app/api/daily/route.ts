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
      nextDate.getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    )}-01`;

  return {
    start,
    next,
  };
}

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

          platform:
            platforms.name,

          applications:
            dailyPlatformStats.applications,

          reservations:
            dailyPlatformStats.reservations,

          sortOrder:
            platforms.sortOrder,
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
          )
        ),

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
        ])
      ).sort();

    const days =
      dates.map(
        (date) => {
          const dayPlatforms =
            platformRows.filter(
              (row) =>
                row.date ===
                date
            );

          const applications =
            dayPlatforms.reduce(
              (sum, row) =>
                sum +
                row.applications,
              0
            );

          const reservations =
            dayPlatforms.reduce(
              (sum, row) =>
                sum +
                row.reservations,
              0
            );

          const call =
            callRows.find(
              (row) =>
                row.date ===
                date
            );

          const incall =
            incallRows.find(
              (row) =>
                row.date ===
                date
            );

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

          const cancellationCount =
            cancellationRows.filter(
              (row) =>
                row.date ===
                date
            ).length;

          return {
            date,

            applications,

            reservations,

            rate:
              applications >
              0
                ? (reservations /
                    applications) *
                  100
                : 0,

            platforms:
              dayPlatforms.map(
                (row) => ({
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
                })
              ),

            previousCall: {
              total:
                call?.previousTotal ??
                0,

              details:
                call?.previousDetails ??
                {},
            },

            sevenCall: {
              total:
                call?.sevenTotal ??
                0,

              details:
                call?.sevenDetails ??
                {},
            },

            visitSources,

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

            cancellationCount,
          };
        }
      );

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