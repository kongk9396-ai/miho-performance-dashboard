import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { dailyCategoryConversionStats } from "@/lib/db/schema";
import { isAdminAuthenticated } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const categories = [
  "코",
  "눈",
  "리프팅",
  "쁘띠",
] as const;

function isValidCategory(
  value: string
) {
  return categories.includes(
    value as (typeof categories)[number]
  );
}

export async function GET(
  request: NextRequest
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        ok: false,
        message: "관리자 로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const date =
      request.nextUrl.searchParams
        .get("date")
        ?.trim();

    if (!date) {
      return NextResponse.json({
        ok: true,
        data: [],
      });
    }

    const rows = await db
      .select()
      .from(
        dailyCategoryConversionStats
      )
      .where(
        eq(
          dailyCategoryConversionStats.date,
          date
        )
      );

    return NextResponse.json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error(
      "GET category conversion error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "카테고리 데이터를 불러오지 못했습니다.",
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
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        ok: false,
        message: "관리자 로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const body =
      await request.json();

    const date =
      String(
        body.date ?? ""
      ).trim();

    const rows =
      Array.isArray(body.rows)
        ? body.rows
        : [];

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        date
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "날짜 형식이 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    for (const row of rows) {
      const category =
        String(
          row.category ?? ""
        ).trim();

      const consultations =
        Number(
          row.consultations ?? 0
        );

      const surgeries =
        Number(
          row.surgeries ?? 0
        );

      if (
        !isValidCategory(
          category
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "허용되지 않은 카테고리입니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isInteger(
          consultations
        ) ||
        !Number.isInteger(
          surgeries
        ) ||
        consultations < 0 ||
        surgeries < 0
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "상담 및 수술 건수는 0 이상의 정수여야 합니다.",
          },
          {
            status: 400,
          }
        );
      }

      await db
        .insert(
          dailyCategoryConversionStats
        )
        .values({
          date,
          category,
          consultations,
          surgeries,
          updatedAt:
            new Date(),
        })
        .onConflictDoUpdate({
          target: [
            dailyCategoryConversionStats.date,
            dailyCategoryConversionStats.category,
          ],
          set: {
            consultations,
            surgeries,
            updatedAt:
              new Date(),
          },
        });
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "POST category conversion error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "카테고리 데이터를 저장하지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}