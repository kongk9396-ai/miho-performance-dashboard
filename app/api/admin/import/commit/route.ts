import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";

import {
  dailyPlatformStats,
  monthlyConversionStats,
  monthlyPlatformStats,
  platforms,
} from "@/lib/db/schema";

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
  return value.trim().replace(/\s+/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImportBody;

    if (!body.months?.length) {
      return NextResponse.json(
        {
          ok: false,
          message: "저장할 데이터가 없습니다.",
        },
        { status: 400 }
      );
    }

    const mode = body.mode === "skip" ? "skip" : "overwrite";

    const platformMasters = await db.select().from(platforms);

    const platformMap = new Map(
      platformMasters.map((row) => [
        normalizePlatformName(row.name),
        row,
      ])
    );

    let savedMonths = 0;
    let skippedMonths = 0;
    let dailyRowsSaved = 0;

    for (const monthData of body.months) {
      const existingMonth = await db
        .select({
          id: monthlyPlatformStats.id,
        })
        .from(monthlyPlatformStats)
        .where(eq(monthlyPlatformStats.month, monthData.month));

      if (mode === "skip" && existingMonth.length > 0) {
        skippedMonths++;
        continue;
      }

      /*
        신규 플랫폼 자동 생성
      */

      const allPlatformNames = Array.from(
        new Set([
          ...monthData.platforms.map((row) => row.platform),
          ...(monthData.dailyPlatforms ?? []).map((row) => row.platform),
        ])
      );

      for (const platformName of allPlatformNames) {
        const normalized = normalizePlatformName(platformName);

        if (platformMap.has(normalized)) continue;

        const [created] = await db
          .insert(platforms)
          .values({
            name: platformName,
            sortOrder: platformMap.size + 1,
            isActive: true,
            includeInTotal: true,
            includeInChannelChart: normalized !== "인콜",
          })
          .returning();

        platformMap.set(normalized, created);
      }

      /*
        월간 플랫폼
      */

      for (const row of monthData.platforms) {
        const platform = platformMap.get(
          normalizePlatformName(row.platform)
        );

        if (!platform) continue;

        await db
          .insert(monthlyPlatformStats)
          .values({
            month: monthData.month,
            platformId: platform.id,
            applications: Math.max(0, Math.round(row.applications || 0)),
            reservations: Math.max(0, Math.round(row.reservations || 0)),
          })
          .onConflictDoUpdate({
            target: [
              monthlyPlatformStats.month,
              monthlyPlatformStats.platformId,
            ],
            set: {
              applications: Math.max(0, Math.round(row.applications || 0)),
              reservations: Math.max(0, Math.round(row.reservations || 0)),
              updatedAt: new Date(),
            },
          });
      }

      /*
        일별 플랫폼
      */

      for (const row of monthData.dailyPlatforms ?? []) {
        const platform = platformMap.get(
          normalizePlatformName(row.platform)
        );

        if (!platform) continue;

        await db
          .insert(dailyPlatformStats)
          .values({
            date: row.date,
            platformId: platform.id,
            applications: Math.max(0, Math.round(row.applications || 0)),
            reservations: Math.max(0, Math.round(row.reservations || 0)),
          })
          .onConflictDoUpdate({
            target: [
              dailyPlatformStats.date,
              dailyPlatformStats.platformId,
            ],
            set: {
              applications: Math.max(0, Math.round(row.applications || 0)),
              reservations: Math.max(0, Math.round(row.reservations || 0)),
              updatedAt: new Date(),
            },
          });

        dailyRowsSaved++;
      }

      /*
        월간 상담/수술
      */

      if (
        monthData.consultations !== null ||
        monthData.surgeries !== null
      ) {
        await db
          .insert(monthlyConversionStats)
          .values({
            month: monthData.month,
            consultations: Math.max(
              0,
              Math.round(monthData.consultations || 0)
            ),
            surgeries: Math.max(0, Math.round(monthData.surgeries || 0)),
          })
          .onConflictDoUpdate({
            target: monthlyConversionStats.month,
            set: {
              consultations: Math.max(
                0,
                Math.round(monthData.consultations || 0)
              ),
              surgeries: Math.max(
                0,
                Math.round(monthData.surgeries || 0)
              ),
              updatedAt: new Date(),
            },
          });
      }

      savedMonths++;
    }

    return NextResponse.json({
      ok: true,
      message: `${savedMonths}개월 저장 · 일별 ${dailyRowsSaved}건 저장${
        skippedMonths ? ` · ${skippedMonths}개월 건너뜀` : ""
      }`,
    });
  } catch (error) {
    console.error("commit error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "DB 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}