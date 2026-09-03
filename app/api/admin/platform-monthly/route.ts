import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  asc,
  eq,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";

import {
  adminMonthLocks,
  monthlyPlatformStats,
  platforms,
} from "@/lib/db/schema";

import {
  isAdminAuthenticated,
} from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeMonth(
  value: unknown
) {
  const raw =
    String(
      value ?? ""
    ).trim();

  const match =
    raw.match(
      /^(\d{4})-(\d{2})(?:-\d{2})?$/
    );

  if (!match) {
    return null;
  }

  const monthNumber =
    Number(match[2]);

  if (
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-01`;
}

function safeNumber(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(number)
  );
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
        request.nextUrl
          .searchParams
          .get("month")
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

    const [
      platformRows,
      statRows,
      lockRows,
    ] =
      await Promise.all([
        db
          .select({
            id:
              platforms.id,

            name:
              platforms.name,

            sortOrder:
              platforms.sortOrder,

            isActive:
              platforms.isActive,

            includeInTotal:
              platforms.includeInTotal,

            includeInChannelChart:
              platforms.includeInChannelChart,
          })
          .from(platforms)
          .where(
            eq(
              platforms.isActive,
              true
            )
          )
          .orderBy(
            asc(
              platforms.sortOrder
            )
          ),

        db
          .select({
            platformId:
              monthlyPlatformStats.platformId,

            applications:
              monthlyPlatformStats.applications,

            reservations:
              monthlyPlatformStats.reservations,
          })
          .from(
            monthlyPlatformStats
          )
          .where(
            eq(
              monthlyPlatformStats.month,
              month
            )
          ),

        db
          .select({
            isLocked:
              adminMonthLocks.isLocked,

            lockedAt:
              adminMonthLocks.lockedAt,
          })
          .from(
            adminMonthLocks
          )
          .where(
            eq(
              adminMonthLocks.month,
              month
            )
          ),
      ]);

    const statMap =
      new Map(
        statRows.map(
          (row) => [
            row.platformId,
            row,
          ]
        )
      );

    return NextResponse.json({
      ok: true,

      month,

      isLocked:
        lockRows[0]
          ?.isLocked ??
        false,

      lockedAt:
        lockRows[0]
          ?.lockedAt ??
        null,

      platforms:
        platformRows.map(
          (platform) => {
            const stat =
              statMap.get(
                platform.id
              );

            return {
              id:
                platform.id,

              name:
                platform.name,

              sortOrder:
                platform.sortOrder,

              includeInTotal:
                platform.includeInTotal,

              includeInChannelChart:
                platform.includeInChannelChart,

              applications:
                Number(
                  stat
                    ?.applications ??
                    0
                ),

              reservations:
                Number(
                  stat
                    ?.reservations ??
                    0
                ),
            };
          }
        ),
    });
  } catch (error) {
    console.error(
      "platform monthly GET error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "플랫폼 데이터를 불러오지 못했습니다.",
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

type SaveBody = {
  month?: string;

  action?:
    | "save"
    | "lock"
    | "unlock";

  platforms?: {
    id: number;
    applications: number;
    reservations: number;
  }[];
};

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
      normalizeMonth(
        body.month
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

    const action =
      body.action ??
      "save";


    /* ======================================================
       마감 / 해제
    ====================================================== */

    if (
      action === "lock" ||
      action === "unlock"
    ) {
      const isLocked =
        action ===
        "lock";

      await db
        .insert(
          adminMonthLocks
        )
        .values({
          month,

          isLocked,

          lockedAt:
            isLocked
              ? new Date()
              : null,
        })
        .onConflictDoUpdate({
          target:
            adminMonthLocks.month,

          set: {
            isLocked,

            lockedAt:
              isLocked
                ? new Date()
                : null,

            updatedAt:
              new Date(),
          },
        });

      return NextResponse.json({
        ok: true,

        message:
          isLocked
            ? "해당 월을 마감했습니다."
            : "해당 월 마감을 해제했습니다.",
      });
    }


    /* ======================================================
       저장 전 마감 여부 확인
    ====================================================== */

    const [
      lock,
    ] =
      await db
        .select({
          isLocked:
            adminMonthLocks.isLocked,
        })
        .from(
          adminMonthLocks
        )
        .where(
          eq(
            adminMonthLocks.month,
            month
          )
        )
        .limit(1);

    if (
      lock?.isLocked
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "마감된 월입니다. 마감을 해제한 후 수정해 주세요.",
        },
        {
          status: 409,
        }
      );
    }


    /* ======================================================
       플랫폼 저장
    ====================================================== */

    const rows =
      Array.isArray(
        body.platforms
      )
        ? body.platforms
        : [];

    for (
      const row of rows
    ) {
      const applications =
        safeNumber(
          row.applications
        );

      const reservations =
        safeNumber(
          row.reservations
        );

      await db
        .insert(
          monthlyPlatformStats
        )
        .values({
          month,

          platformId:
            Number(
              row.id
            ),

          applications,

          reservations,
        })
        .onConflictDoUpdate({
          target: [
            monthlyPlatformStats.month,
            monthlyPlatformStats.platformId,
          ],

          set: {
            applications,

            reservations,

            updatedAt:
              new Date(),
          },
        });
    }

    return NextResponse.json({
      ok: true,
      message:
        "플랫폼 월간 실적을 저장했습니다.",
    });
  } catch (error) {
    console.error(
      "platform monthly POST error:",
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
