from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_daily_parser_final_{stamp}")
shutil.copy2(p, bak)

# parseDailyConversionLayout 함수 전체 위치 찾기
start = s.find("function parseDailyConversionLayout(")

if start < 0:
    raise RuntimeError(
        "parseDailyConversionLayout 함수를 찾지 못했습니다."
    )

# 바로 다음 함수 시작점
end = s.find(
    "function parseMonthlyConversionLayout(",
    start
)

if end < 0:
    raise RuntimeError(
        "parseMonthlyConversionLayout 시작점을 찾지 못했습니다."
    )

new_func = r'''function parseDailyConversionLayout(
  rows: unknown[][],
  month: string
) {
  const result: DailyConversionRow[] = [];

  /*
   * MIHO 예약 변환율 Excel 실제 고정 구조
   *
   * Excel:
   * Y  = 일자
   * Z  = 수술 수
   * AA = 상담
   * AB = 수술 전환
   * AC = 전환율
   *
   * 배열 index:
   * Y  = 24
   * Z  = 25
   * AA = 26
   * AB = 27
   */

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];

    const rawDate = row[24];

    if (
      rawDate === null ||
      rawDate === undefined ||
      rawDate === ""
    ) {
      continue;
    }

    let date: string | null = null;

    // XLSX cellDates:true
    if (rawDate instanceof Date) {
      date =
        `${rawDate.getFullYear()}-` +
        `${String(rawDate.getMonth() + 1).padStart(2, "0")}-` +
        `${String(rawDate.getDate()).padStart(2, "0")}`;
    }

    // 혹시 Excel serial number가 들어온 경우
    else if (typeof rawDate === "number") {
      const parsed = XLSX.SSF.parse_date_code(rawDate);

      if (parsed) {
        date =
          `${parsed.y}-` +
          `${String(parsed.m).padStart(2, "0")}-` +
          `${String(parsed.d).padStart(2, "0")}`;
      }
    }

    // 문자열 날짜
    else {
      const text = String(rawDate).trim();

      let match = text.match(
        /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
      );

      if (match) {
        date =
          `${match[1]}-` +
          `${String(Number(match[2])).padStart(2, "0")}-` +
          `${String(Number(match[3])).padStart(2, "0")}`;
      } else {
        /*
         * 8/1, 08-01 형태도 대응.
         * month = YYYY-MM
         */
        match = text.match(
          /^(\d{1,2})[-./](\d{1,2})$/
        );

        if (match) {
          const year = month.slice(0, 4);

          date =
            `${year}-` +
            `${String(Number(match[1])).padStart(2, "0")}-` +
            `${String(Number(match[2])).padStart(2, "0")}`;
        }
      }
    }

    if (!date) {
      continue;
    }

    // 현재 시트의 해당 월만 허용
    if (!date.startsWith(`${month}-`)) {
      continue;
    }

    const consultations =
      intValue(row[26]) ?? 0;

    const surgeries =
      intValue(row[27]) ?? 0;

    result.push({
      date,
      consultations,
      surgeries,
    });
  }

  /*
   * 같은 날짜가 중복되어 있으면
   * 마지막 값을 사용.
   */
  const deduped = Array.from(
    new Map(
      result.map((row) => [
        row.date,
        row,
      ])
    ).values()
  ).sort(
    (a, b) =>
      a.date.localeCompare(b.date)
  );

  const totalConsultations =
    deduped.reduce(
      (sum, row) =>
        sum + row.consultations,
      0
    );

  const totalSurgeries =
    deduped.reduce(
      (sum, row) =>
        sum + row.surgeries,
      0
    );

  return {
    rows: deduped,

    consultations:
      deduped.length > 0
        ? totalConsultations
        : null,

    surgeries:
      deduped.length > 0
        ? totalSurgeries
        : null,

    /*
     * 월 합계 parser보다 우선되도록 높은 score.
     */
    score:
      deduped.length > 0
        ? 5000 + deduped.length
        : 0,
  };
}

'''

s = s[:start] + new_func + s[end:]

p.write_text(s, encoding="utf-8")

print("")
print("==========================================")
print(" DAILY CONVERSION PARSER REPLACED")
print("==========================================")
print("Y  -> 날짜")
print("AA -> 상담")
print("AB -> 수술전환")
print("backup:", bak)
