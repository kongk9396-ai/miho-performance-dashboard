import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";

import {
  dailyPlatformStats,
  monthlyConversionStats,
  monthlyPlatformStats,
  platforms,
} from "@/lib/db/schema";

import { isAdminAuthenticated } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportMonth = {
  month: string;

  platforms: {
    platform: string;
    applications: number;
    reservations: number;
  }[];

  dailyPlatforms: {
    date: string;
    platform: string;
    applications: number;
    reservations: number;
  }[];

  consultations: number | null;
  surgeries: number | null;
};

type ImportBody = {
  months: ImportMonth[];
  mode: "overwrite" | "skip";
};

function normalizePlatformName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "");
}

function safeNumber(value: unknown) {
  return Math.max(
    0,
    Math.round(Number(value) || 0)
  );
}

export async function POST(
  request: NextRequest
) {
  /*
    관리자 인증
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
      (await request.json()) as ImportBody;

    if (
      !Array.isArray(body.months) ||
      body.months.length === 0
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

    const mode =
      body.mode === "skip"
        ? "skip"
        : "overwrite";

    /*
      플랫폼 마스터
    */

    const platformMasters =
      await db
        .select()
        .from(platforms);

    const platformMap =
      new Map(
        platformMasters.map(
          (row) => [
            normalizePlatformName(
              row.name
            ),
            row,
          ]
        )
      );

    let savedMonths = 0;
    let skippedMonths = 0;
    let dailyRowsSaved = 0;

    /*
      월별 저장
    */

    for (
      const monthData of body.months
    ) {
      if (
        !monthData.month ||
        !/^\d{4}-\d{2}-01$/.test(
          monthData.month
        )
      ) {
        continue;
      }

      /*
        기존 월 존재 여부
      */

      const existingMonth =
        await db
          .select({
            id:
              monthlyPlatformStats.id,
          })
          .from(
            monthlyPlatformStats
          )
          .where(
            eq(
              monthlyPlatformStats.month,
              monthData.month
            )
          );

      /*
        skip 모드라면
        기존 월은 건너뜀
      */

      if (
        mode === "skip" &&
        existingMonth.length > 0
      ) {
        skippedMonths++;
        continue;
      }

      /*
        엑셀에 있는데
        플랫폼 마스터에 없는 플랫폼은
        자동 생성
      */

      const allPlatformNames =
        Array.from(
          new Set([
            ...(
              monthData.platforms ??
              []
            ).map(
              (row) =>
                row.platform
            ),

            ...(
              monthData.dailyPlatforms ??
              []
            ).map(
              (row) =>
                row.platform
            ),
          ])
        ).filter(
          (name) =>
            String(name)
              .trim()
              .length > 0
        );

      for (
        const platformName of
        allPlatformNames
      ) {
        const normalized =
          normalizePlatformName(
            platformName
          );

        if (
          platformMap.has(
            normalized
          )
        ) {
          continue;
        }

        const [created] =
          await db
            .insert(platforms)
            .values({
              name:
                platformName.trim(),

              sortOrder:
                platformMap.size +
                1,

              isActive: true,

              includeInTotal:
                true,

              includeInChannelChart:
                normalized !==
                "총인콜",
            })
            .returning();

        platformMap.set(
          normalized,
          created
        );
      }

      /*
        OVERWRITE 모드

        기존 월 데이터 삭제 후
        새 엑셀 데이터로 재생성

        이렇게 해야 예전에 존재했던
        플랫폼 행이 새 파일에서 빠졌을 때도
        이전 값이 남지 않는다.
      */

      if (mode === "overwrite") {
        await db
          .delete(
            monthlyPlatformStats
          )
          .where(
            eq(
              monthlyPlatformStats.month,
              monthData.month
            )
          );

        /*
          일별 데이터도 해당 월 전체 삭제

          date가 YYYY-MM-DD 형식이라
          Drizzle eq만으로 월 전체 삭제하기
          어려우므로 가져온 일자의 기존값을
          아래에서 upsert한다.

          현재 import 구조에서는
          같은 날짜/플랫폼 값은 덮어쓴다.
        */
      }

      /*
        월별 플랫폼 저장
      */

      for (
        const row of
        monthData.platforms ?? []
      ) {
        const normalized =
          normalizePlatformName(
            row.platform
          );

        const platform =
          platformMap.get(
            normalized
          );

        if (!platform) {
          continue;
        }

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
            month:
              monthData.month,

            platformId:
              platform.id,

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

      /*
        일별 플랫폼 저장
      */

      for (
        const row of
        monthData.dailyPlatforms ??
        []
      ) {
        if (
          !row.date ||
          !/^\d{4}-\d{2}-\d{2}$/.test(
            row.date
          )
        ) {
          continue;
        }

        const normalized =
          normalizePlatformName(
            row.platform
          );

        const platform =
          platformMap.get(
            normalized
          );

        if (!platform) {
          continue;
        }

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
            dailyPlatformStats
          )
          .values({
            date:
              row.date,

            platformId:
              platform.id,

            applications,

            reservations,
          })
          .onConflictDoUpdate({
            target: [
              dailyPlatformStats.date,
              dailyPlatformStats.platformId,
            ],

            set: {
              applications,
              reservations,

              updatedAt:
                new Date(),
            },
          });

        dailyRowsSaved++;
      }

      /*
        상담 / 수술 전환
      */

      if (
        monthData.consultations !==
          null ||
        monthData.surgeries !== null
      ) {
        const consultations =
          safeNumber(
            monthData.consultations
          );

        const surgeries =
          safeNumber(
            monthData.surgeries
          );

        await db
          .insert(
            monthlyConversionStats
          )
          .values({
            month:
              monthData.month,

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
      }

      savedMonths++;
    }

    return NextResponse.json({
      ok: true,

      message:
        "엑셀 데이터를 저장했습니다.",

      savedMonths,
      skippedMonths,
      dailyRowsSaved,
    });
  } catch (error) {
    console.error(
      "Excel import commit error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "엑셀 데이터 저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}