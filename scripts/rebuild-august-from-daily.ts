import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import {
  and,
  eq,
  gte,
  lt,
} from "drizzle-orm";

import { db } from "../lib/db";

import {
  dailyPlatformStats,
  monthlyPlatformStats,
  platforms,
} from "../lib/db/schema";

async function main() {
  const month = "2026-08-01";
  const nextMonth = "2026-09-01";

  console.log("2026년 8월 일별 데이터 조회 중...");

  const rows = await db
    .select({
      platformId:
        dailyPlatformStats.platformId,

      platformName:
        platforms.name,

      applications:
        dailyPlatformStats.applications,

      reservations:
        dailyPlatformStats.reservations,

      date:
        dailyPlatformStats.date,
    })
    .from(dailyPlatformStats)
    .innerJoin(
      platforms,
      eq(
        dailyPlatformStats.platformId,
        platforms.id
      )
    )
    .where(
      and(
        gte(
          dailyPlatformStats.date,
          month
        ),
        lt(
          dailyPlatformStats.date,
          nextMonth
        )
      )
    );

  if (rows.length === 0) {
    console.log(
      "❌ 8월 daily_platform_stats 데이터가 없습니다."
    );

    process.exit(1);
  }

  const totals = new Map<
    number,
    {
      name: string;
      applications: number;
      reservations: number;
    }
  >();

  for (const row of rows) {
    const existing =
      totals.get(row.platformId) ?? {
        name: row.platformName,
        applications: 0,
        reservations: 0,
      };

    existing.applications +=
      row.applications;

    existing.reservations +=
      row.reservations;

    totals.set(
      row.platformId,
      existing
    );
  }

  console.log("");
  console.log("===== 8월 일별 합계 =====");

  for (const [
    platformId,
    value,
  ] of totals) {
    console.log(
      `${value.name}: 신청 ${value.applications} / 예약 ${value.reservations}`
    );

    await db
      .insert(
        monthlyPlatformStats
      )
      .values({
        month,
        platformId,
        applications:
          value.applications,
        reservations:
          value.reservations,
      })
      .onConflictDoUpdate({
        target: [
          monthlyPlatformStats.month,
          monthlyPlatformStats.platformId,
        ],

        set: {
          applications:
            value.applications,

          reservations:
            value.reservations,

          updatedAt:
            new Date(),
        },
      });
  }

  const totalApplications =
    Array.from(
      totals.values()
    ).reduce(
      (sum, row) =>
        sum +
        row.applications,
      0
    );

  const totalReservations =
    Array.from(
      totals.values()
    ).reduce(
      (sum, row) =>
        sum +
        row.reservations,
      0
    );

  console.log("");
  console.log("========================");
  console.log(
    `✅ 8월 총 신청: ${totalApplications}`
  );
  console.log(
    `✅ 8월 총 예약: ${totalReservations}`
  );
  console.log(
    "✅ monthly_platform_stats_v2 재집계 완료"
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exit(1);
  }
);