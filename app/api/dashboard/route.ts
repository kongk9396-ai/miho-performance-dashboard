import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAvailableMonths,
  getDashboardData,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest
) {
  try {
    const month =
      request.nextUrl.searchParams.get(
        "month"
      );

    if (!month) {
      return NextResponse.json(
        {
          ok: false,
          message: "기준월이 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const availableMonths =
      await getAvailableMonths();

    if (!availableMonths.includes(month)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "해당 월 데이터가 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    const data =
      await getDashboardData(month);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error(
      "Dashboard API error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "대시보드 데이터를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}