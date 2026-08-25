import dotenv from "dotenv";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

import { db } from "../lib/db";
import {
  monthlyPlatformStats,
  monthlyConversionStats,
} from "../lib/db/schema";

async function main() {
  const month = "2026-07-01";

  await db
    .delete(monthlyPlatformStats)
    .where(eq(monthlyPlatformStats.month, month));

  await db.insert(monthlyPlatformStats).values([
    {
      month,
      platform: "바비톡",
      applications: 36,
      reservations: 16,
    },
    {
      month,
      platform: "강남언니",
      applications: 51,
      reservations: 27,
    },
    {
      month,
      platform: "네이버",
      applications: 93,
      reservations: 75,
    },
    {
      month,
      platform: "플러스친구",
      applications: 122,
      reservations: 78,
    },
    {
      month,
      platform: "홈페이지",
      applications: 109,
      reservations: 55,
    },
    {
      month,
      platform: "인콜",
      applications: 240,
      reservations: 240,
    },
    {
      month,
      platform: "CPA",
      applications: 131,
      reservations: 12,
    },
  ]);

  await db
    .delete(monthlyConversionStats)
    .where(eq(monthlyConversionStats.month, month));

  await db.insert(monthlyConversionStats).values({
    month,
    consultations: 364,
    surgeries: 115,
  });

  console.log("✅ 2026년 7월 데이터 입력 완료");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

