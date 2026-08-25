import dotenv from "dotenv";
import { asc, eq } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

import { db } from "../lib/db";
import {
  monthlyPlatformStats,
  monthlyConversionStats,
  platforms,
} from "../lib/db/schema";

async function main() {
  const platformRows = await db
    .select({
      month: monthlyPlatformStats.month,
      platform: platforms.name,
      applications: monthlyPlatformStats.applications,
      reservations: monthlyPlatformStats.reservations,
    })
    .from(monthlyPlatformStats)
    .innerJoin(
      platforms,
      eq(monthlyPlatformStats.platformId, platforms.id)
    )
    .orderBy(asc(monthlyPlatformStats.month));

  const conversionRows = await db
    .select()
    .from(monthlyConversionStats)
    .orderBy(asc(monthlyConversionStats.month));

  const months = Array.from(
    new Set([
      ...platformRows.map((row) => row.month),
      ...conversionRows.map((row) => row.month),
    ])
  ).sort();

  console.log("\n========== DB 월별 데이터 확인 ==========\n");

  for (const month of months) {
    const rows = platformRows.filter((row) => row.month === month);
    const conversion = conversionRows.find((row) => row.month === month);

    const applications = rows.reduce(
      (sum, row) => sum + row.applications,
      0
    );

    const reservations = rows.reduce(
      (sum, row) => sum + row.reservations,
      0
    );

    console.log(month);
    console.log(`  플랫폼: ${rows.length}개`);
    console.log(`  신청 합계: ${applications}`);
    console.log(`  예약 합계: ${reservations}`);
    console.log(`  상담: ${conversion?.consultations ?? "없음"}`);
    console.log(`  수술: ${conversion?.surgeries ?? "없음"}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});