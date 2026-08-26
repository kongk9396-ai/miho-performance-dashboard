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
  platforms,
} from "@/lib/db/schema";

import {
  isAdminAuthenticated,
} from "@/lib/auth/admin";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

type CreateBody = {
  name: string;
  sortOrder?: number;
  includeInTotal?: boolean;
  includeInChannelChart?: boolean;
};

type UpdateBody = {
  id: number;
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
  includeInTotal?: boolean;
  includeInChannelChart?: boolean;
};

function cleanName(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function safeSortOrder(
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
플랫폼 전체 목록
=========================================
*/

export async function GET() {
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
    const rows =
      await db
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

          createdAt:
            platforms.createdAt,

          updatedAt:
            platforms.updatedAt,
        })
        .from(platforms)
        .orderBy(
          asc(
            platforms.sortOrder
          ),
          asc(
            platforms.id
          )
        );

    return NextResponse.json({
      ok: true,
      platforms: rows,
    });
  } catch (error) {
    console.error(
      "Admin platforms GET error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "플랫폼 목록을 불러오지 못했습니다.",
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
새 플랫폼 추가
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
      (await request.json()) as CreateBody;

    const name =
      cleanName(body.name);

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "플랫폼 이름을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================
    이름 중복 확인
    =========================================
    */

    const [existing] =
      await db
        .select({
          id:
            platforms.id,
        })
        .from(platforms)
        .where(
          eq(
            platforms.name,
            name
          )
        )
        .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "이미 등록된 플랫폼 이름입니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
    =========================================
    정렬순서 미입력 시 마지막에 추가
    =========================================
    */

    const allPlatforms =
      await db
        .select({
          sortOrder:
            platforms.sortOrder,
        })
        .from(platforms);

    const maxSortOrder =
      allPlatforms.reduce(
        (max, row) =>
          Math.max(
            max,
            row.sortOrder
          ),
        0
      );

    const sortOrder =
      body.sortOrder ===
      undefined
        ? maxSortOrder + 1
        : safeSortOrder(
            body.sortOrder
          );

    const [created] =
      await db
        .insert(platforms)
        .values({
          name,
          sortOrder,
          isActive: true,

          includeInTotal:
            body.includeInTotal ??
            true,

          includeInChannelChart:
            body.includeInChannelChart ??
            true,
        })
        .returning({
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
        });

    return NextResponse.json({
      ok: true,

      message:
        `${name} 플랫폼을 추가했습니다.`,

      platform:
        created,
    });
  } catch (error) {
    console.error(
      "Admin platforms POST error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "플랫폼 추가 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
=========================================
PATCH
플랫폼 정보 수정
=========================================
*/

export async function PATCH(
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
      (await request.json()) as UpdateBody;

    const id =
      Number(body.id);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "올바른 플랫폼 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    =========================================
    기존 플랫폼 확인
    =========================================
    */

    const [existing] =
      await db
        .select()
        .from(platforms)
        .where(
          eq(
            platforms.id,
            id
          )
        )
        .limit(1);

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "해당 플랫폼을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    const updateData: {
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
      includeInTotal?: boolean;
      includeInChannelChart?: boolean;
      updatedAt: Date;
    } = {
      updatedAt:
        new Date(),
    };

    /*
    =========================================
    이름 변경
    =========================================
    */

    if (
      body.name !==
      undefined
    ) {
      const name =
        cleanName(
          body.name
        );

      if (!name) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "플랫폼 이름은 비워둘 수 없습니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        name !==
        existing.name
      ) {
        const [duplicate] =
          await db
            .select({
              id:
                platforms.id,
            })
            .from(platforms)
            .where(
              eq(
                platforms.name,
                name
              )
            )
            .limit(1);

        if (duplicate) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "이미 등록된 플랫폼 이름입니다.",
            },
            {
              status: 409,
            }
          );
        }
      }

      updateData.name =
        name;
    }

    /*
    =========================================
    정렬순서
    =========================================
    */

    if (
      body.sortOrder !==
      undefined
    ) {
      updateData.sortOrder =
        safeSortOrder(
          body.sortOrder
        );
    }

    /*
    =========================================
    활성 / 비활성
    =========================================
    */

    if (
      typeof body.isActive ===
      "boolean"
    ) {
      updateData.isActive =
        body.isActive;
    }

    /*
    =========================================
    전체 합계 포함 여부
    =========================================
    */

    if (
      typeof body.includeInTotal ===
      "boolean"
    ) {
      updateData.includeInTotal =
        body.includeInTotal;
    }

    /*
    =========================================
    채널 차트 포함 여부
    =========================================
    */

    if (
      typeof body.includeInChannelChart ===
      "boolean"
    ) {
      updateData.includeInChannelChart =
        body.includeInChannelChart;
    }

    /*
    =========================================
    UPDATE
    =========================================
    */

    const [updated] =
      await db
        .update(platforms)
        .set(updateData)
        .where(
          eq(
            platforms.id,
            id
          )
        )
        .returning({
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
        });

    return NextResponse.json({
      ok: true,

      message:
        "플랫폼 정보를 수정했습니다.",

      platform:
        updated,
    });
  } catch (error) {
    console.error(
      "Admin platforms PATCH error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "플랫폼 정보 수정 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}