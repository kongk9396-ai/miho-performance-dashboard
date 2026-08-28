import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  eq,
  gte,
  lt,
  sql,
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

import {
  isAdminAuthenticated,
} from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlatformRow = {
  platform: string;
  applications: number;
  reservations: number;
  raw?: string;
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

type SaveBody = {
  days: SaveDay[];
};

function normalize(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function safeNumber(
  value: unknown
) {
  return Math.max(
    0,
    Math.round(
      Number(value) || 0
    )
  );
}

function isValidDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function getMonthStart(
  date: string
) {
  return `${date.slice(
    0,
    7
  )}-01`;
}

function getNextMonth(
  month: string
) {
  const [year, monthNumber] =
    month
      .split("-")
      .map(Number);

  const date =
    new Date(
      year,
      monthNumber,
      1
    );

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-01`;
}

/*
  플랫폼 이름이 플랫폼 마스터에 없으면
  자동으로 생성
*/
async function getOrCreatePlatform(
  platformName: string
) {
  const cleanName =
    platformName.trim();

  const normalized =
    normalize(cleanName);

  const existingPlatforms =
    await db
      .select()
      .from(platforms);

  const existing =
    existingPlatforms.find(
      (row) =>
        normalize(row.name) ===
        normalized
    );

  if (existing) {
    return existing;
  }

  const [created] =
    await db
      .insert(platforms)
      .values({
        name: cleanName,

        sortOrder:
          existingPlatforms.length +
          1,

        isActive: true,

        includeInTotal: true,

        includeInChannelChart:
          normalized !==
          "총인콜",
      })
      .returning();

  return created;
}

/*
  해당 월의 일별 플랫폼 데이터를 전부 합산해서
  월별 플랫폼 데이터를 다시 생성

  즉:
  8/1 + 8/3 + 8/4 ...
  ↓
  2026-08 월간 보기 자동 갱신
*/
async function rebuildMonthlyPlatformStats(
  month: string
) {
  const nextMonth =
    getNextMonth(month);

  const totals =
    await db
      .select({
        platformId:
          dailyPlatformStats.platformId,

        applications:
          sql<number>`
            coalesce(
              sum(
                ${dailyPlatformStats.applications}
              ),
              0
            )
          `,

        reservations:
          sql<number>`
            coalesce(
              sum(
                ${dailyPlatformStats.reservations}
              ),
              0
            )
          `,
      })
      .from(
        dailyPlatformStats
      )
      .where(
        and(
          gte(
            dailyPlatformStats.date,
            month
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

  /*
    기존 월별 데이터 삭제
  */
  await db
    .delete(
      monthlyPlatformStats
    )
    .where(
      eq(
        monthlyPlatformStats.month,
        month
      )
    );

  /*
    일별 합산 결과를
    월별 데이터로 다시 저장
  */
  if (
    totals.length > 0
  ) {
    await db
      .insert(
        monthlyPlatformStats
      )
      .values(
        totals.map(
          (row) => ({
            month,

            platformId:
              row.platformId,

            applications:
              safeNumber(
                row.applications
              ),

            reservations:
              safeNumber(
                row.reservations
              ),
          })
        )
      );
  }
}

export async function POST(
  request: NextRequest
) {
  /*
    관리자 로그인 확인
  */
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

    const days =
      Array.isArray(body.days)
        ? body.days
        : [];

    if (
      days.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "저장할 일별 데이터가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    let reportSaved = 0;
    let platformSaved = 0;
    let callSaved = 0;
    let visitSaved = 0;
    let incallSaved = 0;
    let cancellationSaved = 0;

    /*
      이번 저장에서 수정된 월 목록
    */
    const touchedMonths =
      new Set<string>();

    for (
      const day of days
    ) {
      if (
        !day.date ||
        !isValidDate(
          day.date
        )
      ) {
        continue;
      }

      const month =
        getMonthStart(
          day.date
        );

      touchedMonths.add(
        month
      );

      /*
        ==============================
        1. 원본 텔레그램 보고 저장
        ==============================
      */

      await db
        .insert(
          dailyReports
        )
        .values({
          date:
            day.date,

          rawText:
            day.rawText ?? "",
        })
        .onConflictDoUpdate({
          target:
            dailyReports.date,

          set: {
            rawText:
              day.rawText ?? "",

            updatedAt:
              new Date(),
          },
        });

      reportSaved++;

      /*
        ==============================
        2. 일별 플랫폼 실적
        ==============================

        같은 날짜를 다시 입력하면
        기존 날짜 데이터를 삭제하고
        새 보고 내용으로 교체
      */

      await db
        .delete(
          dailyPlatformStats
        )
        .where(
          eq(
            dailyPlatformStats.date,
            day.date
          )
        );

      for (
        const row of
        day.platforms ?? []
      ) {
        if (
          !row.platform?.trim()
        ) {
          continue;
        }

        const platform =
          await getOrCreatePlatform(
            row.platform
          );

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
              safeNumber(
                row.applications
              ),

            reservations:
              safeNumber(
                row.reservations
              ),
          });

        platformSaved++;
      }

      /*
        ==============================
        3. 전날콜 / 7콜
        ==============================

        daily_call_stats 실제 스키마:

        previousTotal
        previousDetails
        sevenTotal
        sevenDetails

        raw 값은 dailyReports.rawText에
        이미 전체 저장되므로 별도 저장하지 않음
      */

      const previousCall =
        day.previousCall ?? {
          total: 0,
          details: {},
          raw: "",
        };

      const sevenCall =
        day.sevenCall ?? {
          total: 0,
          details: {},
          raw: "",
        };

      await db
        .insert(
          dailyCallStats
        )
        .values({
          date:
            day.date,

          previousTotal:
            safeNumber(
              previousCall.total
            ),

          previousDetails:
            previousCall.details ??
            {},

          sevenTotal:
            safeNumber(
              sevenCall.total
            ),

          sevenDetails:
            sevenCall.details ??
            {},
        })
        .onConflictDoUpdate({
          target:
            dailyCallStats.date,

          set: {
            previousTotal:
              safeNumber(
                previousCall.total
              ),

            previousDetails:
              previousCall.details ??
              {},

            sevenTotal:
              safeNumber(
                sevenCall.total
              ),

            sevenDetails:
              sevenCall.details ??
              {},

            updatedAt:
              new Date(),
          },
        });

      callSaved++;

      /*
        ==============================
        4. 내원경로
        ==============================
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

      for (
        const source of
        day.visitSources ?? []
      ) {
        if (
          !source.source?.trim()
        ) {
          continue;
        }

        await db
          .insert(
            dailyVisitSources
          )
          .values({
            date:
              day.date,

            source:
              source.source.trim(),

            count:
              safeNumber(
                source.count
              ),
          });

        visitSaved++;
      }

      /*
        ==============================
        5. 총인콜
        ==============================
      */

      const incall =
        day.incall ?? {
          total: 0,
          newCount: 0,
          simpleCount: 0,
          changedCount: 0,
          canceledCount: 0,
        };

      await db
        .insert(
          dailyIncallStats
        )
        .values({
          date:
            day.date,

          total:
            safeNumber(
              incall.total
            ),

          newCount:
            safeNumber(
              incall.newCount
            ),

          simpleCount:
            safeNumber(
              incall.simpleCount
            ),

          changedCount:
            safeNumber(
              incall.changedCount
            ),

          canceledCount:
            safeNumber(
              incall.canceledCount
            ),
        })
        .onConflictDoUpdate({
          target:
            dailyIncallStats.date,

          set: {
            total:
              safeNumber(
                incall.total
              ),

            newCount:
              safeNumber(
                incall.newCount
              ),

            simpleCount:
              safeNumber(
                incall.simpleCount
              ),

            changedCount:
              safeNumber(
                incall.changedCount
              ),

            canceledCount:
              safeNumber(
                incall.canceledCount
              ),

            updatedAt:
              new Date(),
          },
        });

      incallSaved++;

      /*
        ==============================
        6. 당일 취소
        ==============================
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

      for (
        const patientText of
        day.cancellations ?? []
      ) {
        const text =
          patientText.trim();

        if (!text) {
          continue;
        }

        await db
          .insert(
            dailyCancellations
          )
          .values({
            date:
              day.date,

            patientText:
              text,
          });

        cancellationSaved++;
      }
    }

    /*
      ==============================
      7. 월별 합계 자동 업데이트
      ==============================
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
        `${reportSaved}일치 데이터를 저장했고 월간 합계도 갱신했습니다.`,

      saved: {
        reports:
          reportSaved,

        platforms:
          platformSaved,

        calls:
          callSaved,

        visitSources:
          visitSaved,

        incalls:
          incallSaved,

        cancellations:
          cancellationSaved,
      },

      rebuiltMonths:
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
          "텔레그램 보고 저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}