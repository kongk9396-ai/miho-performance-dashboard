from pathlib import Path
from datetime import datetime
import shutil

p = Path("app/api/admin/import/commit/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_clean_daily_conversion_{stamp}")
shutil.copy2(p, bak)

old = '''      if (incomingDailyConversions.length > 0) {
        const values =
          incomingDailyConversions.map(
            (row) => ({
              date: row.date,
              consultations:
                safeNumber(row.consultations),
              surgeries:
                safeNumber(row.surgeries),
            })
          );'''

new = '''      if (incomingDailyConversions.length > 0) {

        /*
         * overwrite 모드에서는
         * 해당 월의 기존 상담/수술전환 일별 데이터를
         * 먼저 전부 삭제한다.
         *
         * 과거 잘못 파싱된 날짜/값이 남아서
         * 월 합계에 섞이는 문제 방지.
         */
        if (mode === "overwrite") {
          await db
            .delete(dailyConversionStats)
            .where(
              and(
                gte(
                  dailyConversionStats.date,
                  monthStart
                ),
                lt(
                  dailyConversionStats.date,
                  nextMonthStart
                )
              )
            );
        }

        const values =
          incomingDailyConversions.map(
            (row) => ({
              date: row.date,
              consultations:
                safeNumber(row.consultations),
              surgeries:
                safeNumber(row.surgeries),
            })
          );'''

if old not in s:
    raise RuntimeError(
        "dailyConversion 저장 블록을 못 찾았습니다. 파일 수정 안 함."
    )

s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

print("")
print("========================================")
print(" DAILY CONVERSION OVERWRITE FIXED")
print("========================================")
print("덮어쓰기 시 기존 월 데이터 삭제")
print("→ Excel 정확한 일별 데이터 재저장")
print("→ 오래된 잘못된 행 잔존 방지")
print("backup:", bak.name)
