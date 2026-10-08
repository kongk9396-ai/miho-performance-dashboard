from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_FINAL_DAILY_{stamp}")
shutil.copy2(p, bak)

# =========================================================
# 1. parseDailyConversionLayout 함수 전체 교체
# =========================================================

start = s.find("function parseDailyConversionLayout(")

if start < 0:
    raise RuntimeError(
        "parseDailyConversionLayout 함수를 못 찾았습니다."
    )

end = s.find(
    "function parseMonthlyConversionLayout(",
    start
)

if end < 0:
    raise RuntimeError(
        "parseMonthlyConversionLayout 위치를 못 찾았습니다."
    )

new_func = r'''function parseDailyConversionLayout(
  rows: unknown[][],
  month: string
) {
  const result: DailyConversionRow[] = [];

  /*
   * ============================================
   * MIHO 상담 대비 수술 전환율 표 전용 파서
   *
   * 월마다 표 위치가 이동하므로 열 고정하지 않음.
   *
   * 1. "상담 대비 수술 전환율" 제목 검색
   * 2. 제목 바로 아래 헤더 검색
   * 3. 일별 행을 순서대로 읽음
   * 4. 날짜 셀이 수식/빈값이어도 행 순번으로 복구
   * 5. "월 합계" 행까지 읽음
   * ============================================
   */

  let titleRow = -1;
  let titleCol = -1;

  for (
    let r = 0;
    r < Math.min(rows.length, 120);
    r++
  ) {
    const row = rows[r] ?? [];

    for (
      let c = 0;
      c < row.length;
      c++
    ) {
      const text =
        compactText(
          row[c]
        );

      if (
        text.includes(
          "상담대비수술전환율"
        ) &&
        !text.includes("원장")
      ) {
        titleRow = r;
        titleCol = c;
        break;
      }
    }

    if (titleRow >= 0) {
      break;
    }
  }

  if (
    titleRow < 0 ||
    titleCol < 0
  ) {
    return {
      rows: result,
      consultations:
        null as number | null,
      surgeries:
        null as number | null,
      score: 0,
    };
  }

  const headerRow =
    titleRow + 1;

  const header =
    rows[headerRow] ?? [];

  let dateCol = -1;
  let consultationCol = -1;
  let conversionCol = -1;

  /*
   * 제목 오른쪽 최대 8칸 안에서만
   * 해당 표 헤더 검색.
   *
   * 다른 상담/수술 표와 절대 섞이지 않음.
   */
  for (
    let c = titleCol;
    c <
      Math.min(
        header.length,
        titleCol + 9
      );
    c++
  ) {
    const text =
      compactText(
        header[c]
      );

    if (
      text === "일자" ||
      text === "날짜"
    ) {
      dateCol = c;
    }

    if (
      text === "상담" ||
      text === "상담수" ||
      text === "상담건수"
    ) {
      consultationCol = c;
    }

    if (
      text === "수술전환" ||
      text === "수술전환수" ||
      text === "수술결정" ||
      text === "수술결정수"
    ) {
      conversionCol = c;
    }
  }

  if (
    dateCol < 0 ||
    consultationCol < 0 ||
    conversionCol < 0
  ) {
    return {
      rows: result,
      consultations:
        null as number | null,
      surgeries:
        null as number | null,
      score: 0,
    };
  }

  const targetMonth =
    monthKey(month);

  let sheetTotalConsultations:
    number | null = null;

  let sheetTotalSurgeries:
    number | null = null;

  /*
   * headerRow 다음 행 = 그 달 1일.
   *
   * 이 방식 때문에 첫날 날짜 셀이
   * =B6 같은 수식이어도 절대 빠지지 않는다.
   */
  for (
    let r = headerRow + 1;
    r < rows.length;
    r++
  ) {
    const row =
      rows[r] ?? [];

    const marker =
      compactText(
        row[dateCol]
      );

    /*
     * 월 합계 도달
     */
    if (
      marker === "월합계" ||
      marker === "합계" ||
      marker === "총합"
    ) {
      sheetTotalConsultations =
        intValue(
          row[
            consultationCol
          ]
        );

      sheetTotalSurgeries =
        intValue(
          row[
            conversionCol
          ]
        );

      break;
    }

    /*
     * 헤더 다음 첫 행 = 1일
     */
    const day =
      r - headerRow;

    /*
     * 월 일별표는 최대 31행.
     * 합계 행을 못 찾더라도 다른 표 침범 방지.
     */
    if (
      day < 1 ||
      day > 31
    ) {
      break;
    }

    /*
     * 원래 날짜가 정상이라면 사용.
     * 수식/빈값/파싱 실패면
     * 행 순서 기준 날짜 사용.
     */
    const parsedDate =
      toDateString(
        row[dateCol],
        month
      );

    const fallbackDate =
      `${targetMonth}-${String(
        day
      ).padStart(2, "0")}`;

    const date =
      parsedDate &&
      monthKey(parsedDate) ===
        targetMonth
        ? parsedDate
        : fallbackDate;

    const consultations =
      intValue(
        row[
          consultationCol
        ]
      ) ?? 0;

    const surgeries =
      intValue(
        row[
          conversionCol
        ]
      ) ?? 0;

    result.push({
      date,
      consultations,
      surgeries,
    });
  }

  /*
   * 중복 날짜 방어
   */
  const dailyRows =
    Array.from(
      new Map(
        result.map(
          (row) => [
            row.date,
            row,
          ]
        )
      ).values()
    ).sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    );

  const calculatedConsultations =
    dailyRows.reduce(
      (sum, row) =>
        sum +
        row.consultations,
      0
    );

  const calculatedSurgeries =
    dailyRows.reduce(
      (sum, row) =>
        sum +
        row.surgeries,
      0
    );

  /*
   * 월 합계 행이 존재하면
   * Excel 월 합계를 최종 기준으로 사용.
   *
   * 상세 데이터는 일별 rows 유지.
   */
  const consultations =
    sheetTotalConsultations !==
    null
      ? sheetTotalConsultations
      : calculatedConsultations;

  const surgeries =
    sheetTotalSurgeries !==
    null
      ? sheetTotalSurgeries
      : calculatedSurgeries;

  return {
    rows: dailyRows,

    consultations:
      dailyRows.length > 0
        ? consultations
        : null,

    surgeries:
      dailyRows.length > 0
        ? surgeries
        : null,

    /*
     * 다른 비슷한 표보다 최우선
     */
    score:
      dailyRows.length > 0
        ? 20000 +
          dailyRows.length
        : 0,
  };
}

'''

s = (
    s[:start]
    + new_func
    + s[end:]
)

# =========================================================
# 2. parseSheet가 새 파서를 반드시 쓰게 변경
# =========================================================

pattern_miho = re.compile(
    r'''const\s+dailyConversion\s*=\s*
        parseMihoDailyConversionFromWorksheet\s*\(
        \s*worksheet\s*,\s*month\s*
        \)\s*;''',
    re.VERBOSE
)

replacement = '''const dailyConversion =
    parseDailyConversionLayout(
      rows,
      month
    );'''

s, count = pattern_miho.subn(
    replacement,
    s,
    count=1
)

# 이미 올바른 호출이면 그대로 둠
if count == 0:
    if not re.search(
        r'const\s+dailyConversion\s*=\s*parseDailyConversionLayout\s*\(\s*rows\s*,\s*month\s*\)',
        s
    ):
        raise RuntimeError(
            "dailyConversion 호출 위치를 못 찾았습니다."
        )

# =========================================================
# 3. 임시 DEBUG 로그 제거
# =========================================================

s = re.sub(
    r'''
    \s*console\.log\(
      "==========\s*CONVERSION\s+HEADER\s+DEBUG\s*=========="
      \s*
    \);?
    ''',
    "\n",
    s,
    flags=re.VERBOSE
)

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("============================================")
print(" FINAL DAILY CONVERSION PARSER INSTALLED")
print("============================================")
print("✓ 표 위치 자동 탐색")
print("✓ 첫날 수식 날짜 대응")
print("✓ 휴무일 0/0 유지")
print("✓ 일별 상세 저장")
print("✓ 월 합계 우선")
print("✓ 원장별 기존 기능 유지")
print("backup:", bak.name)
print("============================================")
