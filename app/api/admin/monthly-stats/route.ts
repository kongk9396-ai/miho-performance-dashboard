import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  eq,
} from "drizzle-orm";

import { db } from "@/lib/db";

import {
  managerPerformance,
  managers,
  monthlyConversionStats,
  monthlyPlatformStats,
  platforms,
} from "@/lib/db/schema";

import {
  isAdminAuthenticated,
} from "@/lib/auth/admin";

export const dynamic =
  "force-dynamic";

type PlatformInput = {
  platform: string;
  applications: number;
  reservations: number;
};

type ManagerInput = {
  managerName: string;
  consultations: number;
  surgeries: number;
  revenue: number;
};

type SaveBody = {
  month: string;
  platforms: PlatformInput[];
  consultations: number;
  surgeries: number;
  managers: ManagerInput[];
};

function isMonthDate(
  value: string
) {
  return /^\d{4}-\d{2}-01$/.test(
    value
  );
}

function safeNumber(
  value: unknown
) {
  return Math.max(
    0,
    Number(value) || 0
  );
}

async function requireAdmin() {
  return await isAdminAuthenticated();
}

export async function GET(
  request: NextRequest
) {
  if (
    !(await requireAdmin())
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
      request.nextUrl.searchParams.get(
        "month"
      );

    if (
      !month ||
      !isMonthDate(month)
    ) {
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

    const platformRows =
      await db
        .select({
          platformId:
            monthlyPlatformStats.platformId,

          platform:
            platforms.name,

          applications:
            monthlyPlatformStats.applications,

          reservations:
            monthlyPlatformStats.reservations,

          sortOrder:
            platforms.sortOrder,
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
          eq(
            monthlyPlatformStats.month,
            month
          )
        );

    const [conversion] =
      await db
        .select()
        .from(
          monthlyConversionStats
        )
        .where(
          eq(
            monthlyConversionStats.month,
            month
          )
        );

    const managerRows =
      await db
        .select({
          managerId:
            managerPerformance.managerId,

          managerName:
            managers.name,

          consultations:
            managerPerformance.consultations,

          surgeries:
            managerPerformance.surgeries,

          revenue:
            managerPerformance.revenue,

          sortOrder:
            managers.sortOrder,
        })
        .from(
          managerPerformance
        )
        .innerJoin(
          managers,
          eq(
            managerPerformance.managerId,
            managers.id
          )
        )
        .where(
          eq(
            managerPerformance.month,
            month
          )
        );

    platformRows.sort(
      (a, b) =>
        a.sortOrder -
        b.sortOrder
    );

    managerRows.sort(
      (a, b) =>
        a.sortOrder -
        b.sortOrder
    );

    return NextResponse.json({
      ok: true,

      exists:
        platformRows.length > 0 ||
        Boolean(conversion) ||
        managerRows.length > 0,

      data: {
        month,

        platforms:
          platformRows.map(
            (row) => ({
              platform:
                row.platform,

              applications:
                row.applications,

              reservations:
                row.reservations,
            })
          ),

        consultations:
          conversion
            ?.consultations ??
          0,

        surgeries:
          conversion
            ?.surgeries ??
          0,

        managers:
          managerRows.map(
            (row) => ({
              managerName:
                row.managerName,

              consultations:
                row.consultations,

              surgeries:
                row.surgeries,

              revenue:
                row.revenue,
            })
          ),
      },
    });
  } catch (error) {
    console.error(
      "GET monthly stats error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "월간 데이터를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  if (
    !(await requireAdmin())
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

    if (
      !body.month ||
      !isMonthDate(
        body.month
      )
    ) {
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

    const month =
      body.month;

    for (
      const item of
      body.platforms ?? []
    ) {
      const platformName =
        item.platform.trim();

      if (!platformName) {
        continue;
      }

      const [platformRow] =
        await db
          .select({
            id:
              platforms.id,
          })
          .from(
            platforms
          )
          .where(
            eq(
              platforms.name,
              platformName
            )
          )
          .limit(1);

      if (!platformRow) {
        console.warn(
          `등록되지 않은 플랫폼: ${platformName}`
        );

        continue;
      }

      const applications =
        safeNumber(
          item.applications
        );

      const reservations =
        safeNumber(
          item.reservations
        );

      await db
        .insert(
          monthlyPlatformStats
        )
        .values({
          month,

          platformId:
            platformRow.id,

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

    const consultations =
      safeNumber(
        body.consultations
      );

    const surgeries =
      safeNumber(
        body.surgeries
      );

    await db
      .insert(
        monthlyConversionStats
      )
      .values({
        month,
        consultations,
        surgeries,
      })
      .onConflictDoUpdate({
        target:
          monthlyConversionStats.month,

        set: {
          consultations,
          surgeries,
          updatedAt:
            new Date(),
        },
      });

    await db
      .delete(
        managerPerformance
      )
      .where(
        eq(
          managerPerformance.month,
          month
        )
      );

    const managerInputs =
      (
        body.managers ??
        []
      ).filter(
        (manager) =>
          manager.managerName
            .trim()
            .length >
          0
      );

    for (
      const manager of
      managerInputs
    ) {
      const managerName =
        manager.managerName.trim();

      const [managerRow] =
        await db
          .select({
            id:
              managers.id,
          })
          .from(
            managers
          )
          .where(
            eq(
              managers.name,
              managerName
            )
          )
          .limit(1);

      if (!managerRow) {
        console.warn(
          `등록되지 않은 실장: ${managerName}`
        );

        continue;
      }

      await db
        .insert(
          managerPerformance
        )
        .values({
          month,

          managerId:
            managerRow.id,

          consultations:
            safeNumber(
              manager.consultations
            ),

          surgeries:
            safeNumber(
              manager.surgeries
            ),

          revenue:
            safeNumber(
              manager.revenue
            ),
        });
    }

    return NextResponse.json({
      ok: true,
      message:
        "저장되었습니다.",
    });
  } catch (error) {
    console.error(
      "POST monthly stats error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}