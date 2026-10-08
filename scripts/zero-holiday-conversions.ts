/*
  이미 저장된 일별 상담/수술 데이터 중
  일요일·공휴일에 들어간 값을 0으로 정리한다.
  월간 합계(monthly_conversion_stats)에서도 그만큼 뺀다.

  미리보기:  npx tsx scripts/zero-holiday-conversions.ts
  실제 적용: npx tsx scripts/zero-holiday-conversions.ts --apply
*/

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { eq, inArray } from "drizzle-orm";

import { db } from "../lib/db";

import {
  dailyConversionStats,
  monthlyConversionStats,
} from "../lib/db/schema";

import { getClosedReason } from "../lib/kr-holidays";

async function main() {
  const apply = process.argv.includes("--apply");

  const rows = await db
    .select({
      date: dailyConversionStats.date,
      actualSurgeries: dailyConversionStats.actualSurgeries,
      consultations: dailyConversionStats.consultations,
      surgeries: dailyConversionStats.surgeries,
    })
    .from(dailyConversionStats);

  const targets = rows
    .map((row) => ({
      ...row,
      date: String(row.date).slice(0, 10),
    }))
    .filter(
      (row) =>
        getClosedReason(row.date) &&
        (row.actualSurgeries > 0 ||
          row.consultations > 0 ||
          row.surgeries > 0)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (targets.length === 0) {
    console.log("휴무일에 들어간 값이 없습니다. 정리할 게 없어요.");
    return;
  }

  console.log("휴무일에 값이 들어간 날짜:");

  const byMonth = new Map<
    string,
    { consultations: number; surgeries: number }
  >();

  for (const row of targets) {
    console.log(
      `  ${row.date} (${getClosedReason(row.date)}) 수술 ${row.actualSurgeries} / 상담 ${row.consultations} / 수술결정 ${row.surgeries}`
    );

    const month = `${row.date.slice(0, 7)}-01`;
    const sum = byMonth.get(month) ?? {
      consultations: 0,
      surgeries: 0,
    };

    sum.consultations += row.consultations;
    sum.surgeries += row.surgeries;
    byMonth.set(month, sum);
  }

  if (!apply) {
    console.log(
      "\n미리보기만 했어요. 적용하려면 --apply 붙여서 다시 실행하세요."
    );
    return;
  }

  await db
    .update(dailyConversionStats)
    .set({
      actualSurgeries: 0,
      consultations: 0,
      surgeries: 0,
      updatedAt: new Date(),
    })
    .where(
      inArray(
        dailyConversionStats.date,
        targets.map((row) => row.date)
      )
    );

  for (const [month, removed] of byMonth) {
    const [monthly] = await db
      .select()
      .from(monthlyConversionStats)
      .where(eq(monthlyConversionStats.month, month));

    if (!monthly) continue;

    const consultations = Math.max(
      0,
      monthly.consultations - removed.consultations
    );
    const surgeries = Math.max(
      0,
      monthly.surgeries - removed.surgeries
    );

    await db
      .update(monthlyConversionStats)
      .set({ consultations, surgeries, updatedAt: new Date() })
      .where(eq(monthlyConversionStats.month, month));

    console.log(
      `  ${month.slice(0, 7)} 월 합계: 상담 ${monthly.consultations}→${consultations}, 수술결정 ${monthly.surgeries}→${surgeries}`
    );
  }

  console.log(`\n완료: ${targets.length}일 0으로 정리`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
