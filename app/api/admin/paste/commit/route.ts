import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
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
  dailyReports,
  dailyVisitSources,
  monthlyPlatformStats,
  platforms,
} from "@/lib/db/schema";

export const dynamic =
  "force-dynamic";

type PlatformRow = {
  platform: string;
  applications: number;
  reservations: number;
};

type CallStats = {
  total: number;
  details: Record<
    string,
    number
  >;
  raw: string;
};

type VisitSource = {
  source: string;
  count: number;
};

type IncallStats = {
  total: number;
  newCount: number;
  simpleCount: number;
  changedCount: number;
  canceledCount: number;
};

type SaveDay = {
  date: string;

  rawText: string;

  platforms: PlatformRow[];

  previousCall: CallStats;

  sevenCall: CallStats;

  visitSources: VisitSource[];

  incall: IncallStats;

  cancellations: string[];
};

function normalize(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, "");
}

function getMonthRange(
  dateValue: string
) {
  const [year, month] =
    dateValue
      .split("-")
      .map(Number);

  const start =
    `${year}-${String(
      month
    ).padStart(2, "0")}-01`;

  const nextDate =
    new Date(
      Date.UTC(
        year,
        month,
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

/*
  ★ 핵심

  해당 월 daily_platform_stats를
  다시 처음부터 SUM해서

  monthly_platform_stats_v2를
  갱신한다.

  단순 + 누적 방식이 아니므로
  같은 날짜를 수정해도 합계가
  꼬이지 않는다.
*/

async function rebuildMonthlyPlatformStats(
  month: string
) {
  const {
    start,
    next,
  } = getMonthRange(
    month
  );

  const [
    dailyRows,
    platformRows,
  ] =
    await Promise.all([
      db
        .select({
          platformId:
            dailyPlatformStats.platformId,

          applications:
            dailyPlatformStats.applications,

          reservations:
            dailyPlatformStats.reservations,
        })
        .from(
          dailyPlatformStats
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
        ),

      db
        .select()
        .from(
          platforms
        ),
    ]);

  const totals =
    new Map<
      number,
      {
        applications: number;
        reservations: number;
      }
    >();

  for (const row of dailyRows) {
    const existing =
      totals.get(
        row.platformId
      ) ?? {
        applications: 0,
        reservations: 0,
      };

    existing.applications +=
      row.applications;

    existing.reservations +=
      row.reservations;

    totals.set(
      row.platformId,
      existing
    );
  }

  /*
    일별 데이터가 존재하는 플랫폼만
    월간 값을 갱신.

    과거 월간 데이터가 있는데
    일부 일자만 붙여넣었다고 해서
    다른 플랫폼 월 데이터까지
    0으로 날리지 않도록 함.
  */

  for (
    const [
      platformId,
      values,
    ] of totals
  ) {
    const platformExists =
      platformRows.some(
        (row) =>
          row.id ===
          platformId
      );

    if (!platformExists) {
      continue;
    }

    await db
      .insert(
        monthlyPlatformStats
      )
      .values({
        month: start,

        platformId,

        applications:
          values.applications,

        reservations:
          values.reservations,
      })
      .onConflictDoUpdate({
        target: [
          monthlyPlatformStats.month,
          monthlyPlatformStats.platformId,
        ],

        set: {
          applications:
            values.applications,

          reservations:
            values.reservations,

          updatedAt:
            new Date(),
        },
      });
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const days =
      body.days as SaveDay[];

    if (
      !Array.isArray(days) ||
      days.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "저장할 데이터가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      플랫폼 마스터
    */

    const masterPlatforms =
      await db
        .select()
        .from(
          platforms
        );

    const platformMap =
      new Map(
        masterPlatforms.map(
          (row) => [
            normalize(
              row.name
            ),
            row,
          ]
        )
      );

    const touchedMonths =
      new Set<string>();

    let platformSaved =
      0;

    let reportSaved = 0;

    /*
      날짜별 저장
    */

    for (const day of days) {
      touchedMonths.add(
        `${day.date.slice(
          0,
          7
        )}-01`
      );

      /*
        ① 보고 원문
      */

      await db
        .insert(
          dailyReports
        )
        .values({
          date:
            day.date,

          rawText:
            day.rawText ??
            "",
        })
        .onConflictDoUpdate({
          target:
            dailyReports.date,

          set: {
            rawText:
              day.rawText ??
              "",

            updatedAt:
              new Date(),
          },
        });

      reportSaved++;

      /*
        ② 플랫폼 DB 실적
      */

      for (const row of day.platforms) {
        const normalized =
          normalize(
            row.platform
          );

        let platform =
          platformMap.get(
            normalized
          );

        if (!platform) {
          const [
            created,
          ] =
            await db
              .insert(
                platforms
              )
              .values({
                name:
                  row.platform,

                sortOrder:
                  platformMap.size +
                  1,

                isActive:
                  true,

                includeInTotal:
                  true,

                includeInChannelChart:
                  true,
              })
              .returning();

          platform =
            created;

          platformMap.set(
            normalized,
            created
          );
        }

        await db
          .insert(
            dailyPlatformStats
          )
          .values({
            date:
              day.date,

            platformId:
              platform.id,

            applications:
              Math.max(
                0,
                Math.round(
                  row.applications ??
                    0
                )
              ),

            reservations:
              Math.max(
                0,
                Math.round(
                  row.reservations ??
                    0
                )
              ),
          })
          .onConflictDoUpdate({
            target: [
              dailyPlatformStats.date,
              dailyPlatformStats.platformId,
            ],

            set: {
              applications:
                Math.max(
                  0,
                  Math.round(
                    row.applications ??
                      0
                  )
                ),

              reservations:
                Math.max(
                  0,
                  Math.round(
                    row.reservations ??
                      0
                  )
                ),

              updatedAt:
                new Date(),
            },
          });

        platformSaved++;
      }

      /*
        ③ 전날콜 + 7콜
      */

      await db
        .insert(
          dailyCallStats
        )
        .values({
          date:
            day.date,

          previousTotal:
            day.previousCall
              ?.total ??
            0,

          previousDetails:
            day.previousCall
              ?.details ??
            {},

          sevenTotal:
            day.sevenCall
              ?.total ??
            0,

          sevenDetails:
            day.sevenCall
              ?.details ??
            {},
        })
        .onConflictDoUpdate({
          target:
            dailyCallStats.date,

          set: {
            previousTotal:
              day.previousCall
                ?.total ??
              0,

            previousDetails:
              day.previousCall
                ?.details ??
              {},

            sevenTotal:
              day.sevenCall
                ?.total ??
              0,

            sevenDetails:
              day.sevenCall
                ?.details ??
              {},

            updatedAt:
              new Date(),
          },
        });

      /*
        ④ 내원경로

        같은 날짜를 재저장하면
        기존 내원경로 삭제 후
        다시 넣는다.
      */

      await db
        .delete(
          dailyVisitSources
        )
        .where(
          eq(
            dailyVisitSources.date,
            day.date
          )
        );

      if (
        day.visitSources
          ?.length
      ) {
        await db
          .insert(
            dailyVisitSources
          )
          .values(
            day.visitSources.map(
              (row) => ({
                date:
                  day.date,

                source:
                  row.source,

                count:
                  Math.max(
                    0,
                    Math.round(
                      row.count ??
                        0
                    )
                  ),
              })
            )
          );
      }

      /*
        ⑤ 총인콜
      */

      await db
        .insert(
          dailyIncallStats
        )
        .values({
          date:
            day.date,

          total:
            day.incall
              ?.total ??
            0,

          newCount:
            day.incall
              ?.newCount ??
            0,

          simpleCount:
            day.incall
              ?.simpleCount ??
            0,

          changedCount:
            day.incall
              ?.changedCount ??
            0,

          canceledCount:
            day.incall
              ?.canceledCount ??
            0,
        })
        .onConflictDoUpdate({
          target:
            dailyIncallStats.date,

          set: {
            total:
              day.incall
                ?.total ??
              0,

            newCount:
              day.incall
                ?.newCount ??
              0,

            simpleCount:
              day.incall
                ?.simpleCount ??
              0,

            changedCount:
              day.incall
                ?.changedCount ??
              0,

            canceledCount:
              day.incall
                ?.canceledCount ??
              0,

            updatedAt:
              new Date(),
          },
        });

      /*
        ⑥ 당일취소

        재저장 시 중복 방지
      */

      await db
        .delete(
          dailyCancellations
        )
        .where(
          eq(
            dailyCancellations.date,
            day.date
          )
        );

      if (
        day.cancellations
          ?.length
      ) {
        await db
          .insert(
            dailyCancellations
          )
          .values(
            day.cancellations.map(
              (
                patientText
              ) => ({
                date:
                  day.date,

                patientText,
              })
            )
          );
      }
    }

    /*
      ⑦ 월간 신청/예약 자동 재계산
    */

    for (
      const month of
      touchedMonths
    ) {
      await rebuildMonthlyPlatformStats(
        month
      );
    }

    return NextResponse.json({
      ok: true,

      message:
        `${reportSaved}일 저장 · ` +
        `${platformSaved}개 플랫폼 실적 저장 · ` +
        `${touchedMonths.size}개월 월간 합계 자동 갱신`,

      savedDays:
        reportSaved,

      savedPlatformRows:
        platformSaved,

      updatedMonths:
        Array.from(
          touchedMonths
        ),
    });
  } catch (error) {
    console.error(
      "Telegram commit error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "텔레그램 DB 저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}