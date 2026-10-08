from pathlib import Path
from datetime import datetime
import shutil

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_fix_daily_excel_{stamp}")
shutil.copy2(p, bak)

# ------------------------------------------------------------
# parse candidate가 최종 반환되기 직전,
# candidate.dailyConversions를 실제 Y:AB 기준으로 교정
# ------------------------------------------------------------

needle = '''    dailyConversions: dailyConversion.rows,'''

if needle not in s:
    raise RuntimeError(
        "dailyConversions: dailyConversion.rows 위치를 못 찾았습니다."
    )

replacement = '''    dailyConversions: (() => {
      /*
       * MIHO 예약 변환율 원본 엑셀의 실제 구조
       *
       * Y  = 일자
       * Z  = 수술 수 (참고값)
       * AA = 상담
       * AB = 수술 전환
       *
       * 기존 자동 탐색 결과보다 이 고정 영역을 우선 사용한다.
       */
      const exactRows: DailyConversionRow[] = [];

      for (let rowIndex = 5; rowIndex < rows.length; rowIndex++) {
        const sourceRow = rows[rowIndex] ?? [];

        const rawDate = sourceRow[24];
        const consultations = toNumber(sourceRow[26]);
        const surgeries = toNumber(sourceRow[27]);

        const parsedDate = normalizeDateValue(
          rawDate,
          year,
          month
        );

        if (!parsedDate) {
          continue;
        }

        const monthPrefix =
          `${year}-${String(month).padStart(2, "0")}`;

        if (!parsedDate.startsWith(monthPrefix)) {
          continue;
        }

        exactRows.push({
          date: parsedDate,
          consultations,
          surgeries,
        });
      }

      return exactRows.length > 0
        ? exactRows
        : dailyConversion.rows;
    })(),'''

s = s.replace(needle, replacement, 1)

p.write_text(s, encoding="utf-8")

print("")
print("========================================")
print(" PREVIEW DAILY CONVERSION FIXED")
print("========================================")
print("Y  -> 날짜")
print("AA -> 상담")
print("AB -> 수술전환")
print("backup:", bak)
