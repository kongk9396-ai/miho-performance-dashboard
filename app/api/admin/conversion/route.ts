import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { dailyConversionStats } from "@/lib/db/schema";
import { isAdminAuthenticated } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, message: "관리자 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const date =
      request.nextUrl.searchParams.get("date")?.trim();

    if (!date) {
      return NextResponse.json({
        ok: true,
        data: null,
      });
    }

    const rows = await db
      .select()
      .from(dailyConversionStats)
      .where(eq(dailyConversionStats.date, date))
      .limit(1);

    return NextResponse.json({
      ok: true,
      data: rows[0] ?? null,
    });
  } catch (error) {
    console.error("GET conversion error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "전환 데이터를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, message: "관리자 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const date = String(body.date ?? "").trim();
    const consultations = Number(body.consultations ?? 0);
    const surgeries = Number(body.surgeries ?? 0);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          ok: false,
          message: "날짜 형식이 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(consultations) ||
      !Number.isInteger(surgeries) ||
      consultations < 0 ||
      surgeries < 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "상담 및 수술 건수는 0 이상의 정수여야 합니다.",
        },
        { status: 400 }
      );
    }


    const [saved] = await db
      .insert(dailyConversionStats)
      .values({
        date,
        consultations,
        surgeries,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: dailyConversionStats.date,
        set: {
          consultations,
          surgeries,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({
      ok: true,
      data: saved,
    });
  } catch (error) {
    console.error("POST conversion error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "전환 데이터를 저장하지 못했습니다.",
      },
      { status: 500 }
    );
  }
}