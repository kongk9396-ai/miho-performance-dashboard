import dotenv from "dotenv";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

import { db } from "../lib/db";
import {
  platforms,
  monthlyPlatformStats,
} from "../lib/db/schema";

async function main() {
  const month = "2026-07-01";

  const platformRows = await db.select().from(platforms);

  const platformMap = new Map(
    platformRows.map((row) => [row.name, row.id])
  );

  const julyData = [
    { platform: "바비톡", applications: 36, reservations: 16 },
    { platform: "강남언니", applications: 51, reservations: 27 },
    { platform: "네이버", applications: 93, reservations: 75 },
    { platform: "플러스친구", applications: 122, reservations: 78 },
    { platform: "홈페이지", applications: 109, reservations: 55 },
    { platform: "인콜", applications: 240, reservations: 240 },
    { platform: "CPA", applications: 131, reservations: 12 },
  ];

  await db
    .delete(monthlyPlatformStats)
    .where(eq(monthlyPlatformStats.month, month));

  for (const row of julyData) {
    const platformId = platformMap.get(row.platform);

    if (!platformId) {
      throw new Error(`플랫폼을 찾을 수 없습니다: ${row.platform}`);
    }

    await db.insert(monthlyPlatformStats).values({
      month,
      platformId,
      applications: row.applications,
      reservations: row.reservations,
    });
  }

  console.log("✅ 2026년 7월 플랫폼 데이터 v2 이관 완료");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});