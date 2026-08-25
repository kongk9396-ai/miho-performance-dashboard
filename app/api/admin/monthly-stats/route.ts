import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  managerPerformance,
  monthlyConversionStats,
  monthlyPlatformStats,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

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

function isMonthDate(value: string) {
  return /^\d{4}-\d{2}-01$/.test(value);
}

/* =========================
   GET
   기존 월 데이터 불러오기
========================= */

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month");

    if (!month || !isMonthDate(month)) {
      return NextResponse.json(
        {
          ok: false,
          message: "올바른 기준월이 필요합니다.",
        },
        { status: 400 }
      );
    }

    const platforms = await db
      .select()
      .from(monthlyPlatformStats)
      .where(eq(monthlyPlatformStats.month, month));

    const [conversion] = await db
      .select()
      .from(monthlyConversionStats)
      .where(eq(monthlyConversionStats.month, month));

    const managers = await db
      .select()
      .from(managerPerformance)
      .where(eq(managerPerformance.month, month));

    return NextResponse.json({
      ok: true,
      exists:
        platforms.length > 0 ||
        Boolean(conversion) ||
        managers.length > 0,

      data: {
        month,

        platforms: platforms.map((row) => ({
          platform: row.platform,
          applications: row.applications,
          reservations: row.reservations,
        })),

        consultations: conversion?.consultations ?? 0,
        surgeries: conversion?.surgeries ?? 0,

        managers: managers.map((row) => ({
          managerName: row.managerName,
          consultations: row.consultations,
          surgeries: row.surgeries,
          revenue: row.revenue,
        })),
      },
    });
  } catch (error) {
    console.error("GET monthly stats error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "데이터를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

/* =========================
   POST
   신규 저장 + 기존 월 수정
========================= */

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveBody;

    if (!body.month || !isMonthDate(body.month)) {
      return NextResponse.json(
        {
          ok: false,
          message: "올바른 기준월이 필요합니다.",
        },
        { status: 400 }
      );
    }

    const month = body.month;

    const platforms = body.platforms ?? [];

    for (const item of platforms) {
      await db
        .insert(monthlyPlatformStats)
        .values({
          month,
          platform: item.platform,
          applications: Math.max(0, Number(item.applications) || 0),
          reservations: Math.max(0, Number(item.reservations) || 0),
        })
        .onConflictDoUpdate({
          target: [
            monthlyPlatformStats.month,
            monthlyPlatformStats.platform,
          ],
          set: {
            applications: Math.max(
              0,
              Number(item.applications) || 0
            ),
            reservations: Math.max(
              0,
              Number(item.reservations) || 0
            ),
            updatedAt: new Date(),
          },
        });
    }

    await db
      .insert(monthlyConversionStats)
      .values({
        month,
        consultations: Math.max(
          0,
          Number(body.consultations) || 0
        ),
        surgeries: Math.max(
          0,
          Number(body.surgeries) || 0
        ),
      })
      .onConflictDoUpdate({
        target: monthlyConversionStats.month,
        set: {
          consultations: Math.max(
            0,
            Number(body.consultations) || 0
          ),
          surgeries: Math.max(
            0,
            Number(body.surgeries) || 0
          ),
          updatedAt: new Date(),
        },
      });

    /*
      실장 데이터는 월 단위로 통째로 동기화.
      → 삭제한 실장 행이 DB에 남지 않도록
        해당 월 데이터를 지운 뒤 현재 입력값으로 재생성.
    */

    await db
      .delete(managerPerformance)
      .where(eq(managerPerformance.month, month));

    const managers = (body.managers ?? []).filter(
      (manager) => manager.managerName.trim().length > 0
    );

    if (managers.length > 0) {
      await db.insert(managerPerformance).values(
        managers.map((manager) => ({
          month,
          managerName: manager.managerName.trim(),
          consultations: Math.max(
            0,
            Number(manager.consultations) || 0
          ),
          surgeries: Math.max(
            0,
            Number(manager.surgeries) || 0
          ),
          revenue: Math.max(
            0,
            Number(manager.revenue) || 0
          ),
        }))
      );
    }

    return NextResponse.json({
      ok: true,
      message: "저장되었습니다.",
    });
  } catch (error) {
    console.error("POST monthly stats error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}