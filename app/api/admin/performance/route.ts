import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  asc,
  eq,
} from "drizzle-orm";

import { db } from "@/lib/db";

import {
  managerPerformance,
  managers,
} from "@/lib/db/schema";

import {
  isAdminAuthenticated,
} from "@/lib/auth/admin";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

type ManagerSaveRow = {
  managerId: number;
  consultations: number;
  surgeries: number;
  revenue: number;
};

type SaveBody = {
  month: string;
  managers: ManagerSaveRow[];
};

function isMonth(
  value: string
) {
  return /^\d{4}-\d{2}-01$/.test(
    value
  );
}

function safeNumber(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(number)
  );
}

/*
=========================================
GET
실장별 월 실적 조회
=========================================
*/

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
      request.nextUrl.searchParams.get(
        "month"
      );

    if (
      !month ||
      !isMonth(month)
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

    /*
    =========================================
    1. 실장 마스터 전체 조회

    활성 실장:
    - 실적이 없어도 화면에 표시

    비활성 실장:
    - 해당 월에 과거 실적이 있는 경우만 표시
    =========================================
    */

    const managerList =
      await db
        .select({
          id:
            managers.id,

          name:
            managers.name,

          sortOrder:
            managers.sortOrder,

          isActive:
            managers.isActive,
        })
        .from(managers)
        .orderBy(
          asc(
            managers.sortOrder
          ),
          asc(
            managers.id
          )
        );

    /*
    =========================================
    2. 해당 월 실적 조회
    =========================================
    */

    const performanceRows =
      await db
        .select({
          managerId:
            managerPerformance.managerId,

          consultations:
            managerPerformance.consultations,

          surgeries:
            managerPerformance.surgeries,

          revenue:
            managerPerformance.revenue,
        })
        .from(
          managerPerformance
        )
        .where(
          eq(
            managerPerformance.month,
            month
          )
        );

    const performanceMap =
      new Map(
        performanceRows.map(
          (row) => [
            row.managerId,
            row,
          ]
        )
      );

    /*
    =========================================
    3. 표시할 실장 결정

    활성:
      항상 표시

    비활성:
      해당 월 실적이 있으면 표시
      실적이 없으면 숨김
    =========================================
    */

    const visibleManagers =
      managerList.filter(
        (manager) =>
          manager.isActive ||
          performanceMap.has(
            manager.id
          )
      );

    /*
    =========================================
    4. 실장 + 실적 결합
    =========================================
    */

    const managerRows =
      visibleManagers.map(
        (manager) => {
          const performance =
            performanceMap.get(
              manager.id
            );

          const consultations =
            performance?.consultations ??
            0;

          const surgeries =
            performance?.surgeries ??
            0;

          const revenue =
            performance?.revenue ??
            0;

          return {
            managerId:
              manager.id,

            managerName:
              manager.name,

            isActive:
              manager.isActive,

            sortOrder:
              manager.sortOrder,

            consultations,

            surgeries,

            conversionRate:
              consultations > 0
                ? (surgeries /
                    consultations) *
                  100
                : 0,

            revenue,
          };
        }
      );

    /*
    =========================================
    5. 정렬

    활성 실장 우선
    → sortOrder
    → ID
    =========================================
    */

    managerRows.sort(
      (a, b) => {
        if (
          a.isActive !==
          b.isActive
        ) {
          return a.isActive
            ? -1
            : 1;
        }

        if (
          a.sortOrder !==
          b.sortOrder
        ) {
          return (
            a.sortOrder -
            b.sortOrder
          );
        }

        return (
          a.managerId -
          b.managerId
        );
      }
    );

    /*
    =========================================
    6. 합계
    =========================================
    */

    const totals =
      managerRows.reduce(
        (acc, row) => {
          acc.consultations +=
            row.consultations;

          acc.surgeries +=
            row.surgeries;

          acc.revenue +=
            row.revenue;

          return acc;
        },
        {
          consultations: 0,
          surgeries: 0,
          revenue: 0,
        }
      );

    const conversionRate =
      totals.consultations > 0
        ? (totals.surgeries /
            totals.consultations) *
          100
        : 0;

    return NextResponse.json({
      ok: true,

      data: {
        month,

        summary: {
          consultations:
            totals.consultations,

          surgeries:
            totals.surgeries,

          conversionRate,

          revenue:
            totals.revenue,
        },

        managers:
          managerRows,
      },
    });
  } catch (error) {
    console.error(
      "Admin performance GET error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "실장별 실적을 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
=========================================
POST
실장별 월 실적 저장
=========================================
*/

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

    if (
      !body.month ||
      !isMonth(body.month)
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

    if (
      !Array.isArray(
        body.managers
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "실장 데이터가 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const month =
      body.month;

    /*
    =========================================
    현재 입력값 정리
    =========================================
    */

    const rows =
      body.managers
        .filter(
          (row) =>
            Number.isInteger(
              Number(
                row.managerId
              )
            ) &&
            Number(
              row.managerId
            ) > 0
        )
        .map(
          (row) => ({
            month,

            managerId:
              Number(
                row.managerId
              ),

            consultations:
              safeNumber(
                row.consultations
              ),

            surgeries:
              safeNumber(
                row.surgeries
              ),

            revenue:
              safeNumber(
                row.revenue
              ),
          })
        );

    /*
    =========================================
    실장별 UPSERT

    중요:
    해당 월 전체를 DELETE하지 않는다.

    이유:
    현재 화면에서 숨겨진 비활성 실장의
    과거 실적이 삭제되는 것을 방지하기 위함.
    =========================================
    */

    for (const row of rows) {
      const [existing] =
        await db
          .select({
            id:
              managerPerformance.id,
          })
          .from(
            managerPerformance
          )
          .where(
            eq(
              managerPerformance.month,
              month
            )
          );

      const existingRow =
        existing;

      /*
        위 조회는 월 전체가 아니라
        아래에서 managerId까지 확인해서
        해당 실장 레코드를 찾는다.
      */

      const monthRows =
        await db
          .select({
            id:
              managerPerformance.id,

            managerId:
              managerPerformance.managerId,
          })
          .from(
            managerPerformance
          )
          .where(
            eq(
              managerPerformance.month,
              month
            )
          );

      const matched =
        monthRows.find(
          (item) =>
            item.managerId ===
            row.managerId
        );

      if (matched) {
        await db
          .update(
            managerPerformance
          )
          .set({
            consultations:
              row.consultations,

            surgeries:
              row.surgeries,

            revenue:
              row.revenue,

            updatedAt:
              new Date(),
          })
          .where(
            eq(
              managerPerformance.id,
              matched.id
            )
          );
      } else {
        await db
          .insert(
            managerPerformance
          )
          .values(row);
      }

      void existingRow;
    }

    /*
    =========================================
    저장 후 해당 월 전체 실적 재조회

    비활성 실장의 과거 실적까지 포함해서
    월 합계를 정확하게 계산한다.
    =========================================
    */

    const savedRows =
      await db
        .select({
          consultations:
            managerPerformance.consultations,

          surgeries:
            managerPerformance.surgeries,

          revenue:
            managerPerformance.revenue,
        })
        .from(
          managerPerformance
        )
        .where(
          eq(
            managerPerformance.month,
            month
          )
        );

    const totals =
      savedRows.reduce(
        (acc, row) => {
          acc.consultations +=
            row.consultations;

          acc.surgeries +=
            row.surgeries;

          acc.revenue +=
            row.revenue;

          return acc;
        },
        {
          consultations: 0,
          surgeries: 0,
          revenue: 0,
        }
      );

    const conversionRate =
      totals.consultations > 0
        ? (totals.surgeries /
            totals.consultations) *
          100
        : 0;

    return NextResponse.json({
      ok: true,

      message:
        "실장별 실적과 매출을 저장했습니다.",

      data: {
        month,

        summary: {
          consultations:
            totals.consultations,

          surgeries:
            totals.surgeries,

          conversionRate,

          revenue:
            totals.revenue,
        },

        savedManagers:
          rows.length,
      },
    });
  } catch (error) {
    console.error(
      "Admin performance POST error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "실장별 실적 저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}