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
  managers,
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
};

type UpdateBody = {
  id: number;
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
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
실장 전체 목록
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
            managers.id,

          name:
            managers.name,

          sortOrder:
            managers.sortOrder,

          isActive:
            managers.isActive,

          createdAt:
            managers.createdAt,

          updatedAt:
            managers.updatedAt,
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

    return NextResponse.json({
      ok: true,
      managers: rows,
    });
  } catch (error) {
    console.error(
      "Admin managers GET error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "실장 목록을 불러오지 못했습니다.",
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
새 실장 추가
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
            "실장 이름을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      이름 중복 확인
    */

    const [existing] =
      await db
        .select({
          id:
            managers.id,
        })
        .from(managers)
        .where(
          eq(
            managers.name,
            name
          )
        )
        .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "이미 등록된 실장 이름입니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
      sortOrder 미입력 시
      현재 목록 마지막에 추가
    */

    const allManagers =
      await db
        .select({
          sortOrder:
            managers.sortOrder,
        })
        .from(managers);

    const maxSortOrder =
      allManagers.reduce(
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
        .insert(managers)
        .values({
          name,
          sortOrder,
          isActive: true,
        })
        .returning({
          id:
            managers.id,

          name:
            managers.name,

          sortOrder:
            managers.sortOrder,

          isActive:
            managers.isActive,
        });

    return NextResponse.json({
      ok: true,

      message:
        `${name} 실장을 추가했습니다.`,

      manager:
        created,
    });
  } catch (error) {
    console.error(
      "Admin managers POST error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "실장 추가 중 오류가 발생했습니다.",
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
실장 이름 / 순서 / 활성 상태 수정
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
            "올바른 실장 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const [existing] =
      await db
        .select()
        .from(managers)
        .where(
          eq(
            managers.id,
            id
          )
        )
        .limit(1);

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "해당 실장을 찾을 수 없습니다.",
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
      updatedAt: Date;
    } = {
      updatedAt:
        new Date(),
    };

    /*
      이름 변경
    */

    if (
      body.name !==
      undefined
    ) {
      const name =
        cleanName(body.name);

      if (!name) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "실장 이름은 비워둘 수 없습니다.",
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
                managers.id,
            })
            .from(managers)
            .where(
              eq(
                managers.name,
                name
              )
            )
            .limit(1);

        if (duplicate) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "이미 등록된 실장 이름입니다.",
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
      정렬순서 변경
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
      활성 / 비활성
    */

    if (
      typeof body.isActive ===
      "boolean"
    ) {
      updateData.isActive =
        body.isActive;
    }

    const [updated] =
      await db
        .update(managers)
        .set(updateData)
        .where(
          eq(
            managers.id,
            id
          )
        )
        .returning({
          id:
            managers.id,

          name:
            managers.name,

          sortOrder:
            managers.sortOrder,

          isActive:
            managers.isActive,
        });

    return NextResponse.json({
      ok: true,

      message:
        "실장 정보를 수정했습니다.",

      manager:
        updated,
    });
  } catch (error) {
    console.error(
      "Admin managers PATCH error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "실장 정보 수정 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}