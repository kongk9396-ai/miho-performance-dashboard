from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_EXCEL_DAILY_TOTAL_{stamp}")
shutil.copy2(p, bak)

print("BACKUP:", bak.name)

# ============================================================
# 1. 타입에 일일합계 필드 추가
# ============================================================

for type_name in ["MonthPreview", "SheetCandidate"]:
    pattern = re.compile(
        rf'(type {type_name} = \{{[\s\S]*?dailyPlatforms:\s*DailyPlatformRow\[\];)'
    )

    m = pattern.search(s)

    if not m:
        raise RuntimeError(
            f"{type_name} 타입 위치 못 찾음"
        )

    block = m.group(0)

    if "dailyTotalApplications:" not in block:
        new_block = (
            block
            + "\n  dailyTotalApplications: number | null;"
            + "\n  dailyTotalReservations: number | null;"
        )

        s = (
            s[:m.start()]
            + new_block
            + s[m.end():]
        )


# MonthAccumulator
m = re.search(
    r'(type MonthAccumulator = \{[\s\S]*?dailyMap:\s*Map<string,\s*DailyPlatformRow>;\s*)',
    s
)

if not m:
    raise RuntimeError(
        "MonthAccumulator 위치 못 찾음"
    )

if "dailyTotalApplications:" not in m.group(0):
    replacement = (
        m.group(1)
        + "  dailyTotalApplications: number | null;\n"
        + "  dailyTotalReservations: number | null;\n"
    )

    s = (
        s[:m.start()]
        + replacement
        + s[m.end():]
    )


# ============================================================
# 2. Excel의 실제 '일일 합계' 합계행 parser 추가
# ============================================================

if "function parseExcelDailyGrandTotal(" not in s:

    marker = "function parseDailyPlatformLayout("

    pos = s.find(marker)

    if pos < 0:
        raise RuntimeError(
            "parseDailyPlatformLayout 위치 못 찾음"
        )

    helper = r'''
/*
 * ============================================
 * Excel "일일 합계"의 합계행 직접 읽기
 *
 * 월마다 일일합계 열 위치가 다름:
 * 8/7/6월 U/V
 * 5월 S/T
 * 4월 이하 Q/R ...
 *
 * 따라서 열 번호 고정하지 않고
 * "일일 합계" 헤더를 찾아서 읽는다.
 * ============================================
 */
function parseExcelDailyGrandTotal(
  rows: unknown[][]
) {
  let headerRow = -1;
  let applicationCol = -1;
  let reservationCol = -1;

  /*
   * '일일 합계' 헤더 찾기
   */
  for (
    let r = 0;
    r < Math.min(rows.length, 30);
    r++
  ) {
    const row = rows[r] ?? [];

    for (
      let c = 0;
      c < row.length;
      c++
    ) {
      if (
        compactText(row[c]) ===
        "일일합계"
      ) {
        headerRow = r;
        applicationCol = c;
        reservationCol = c + 1;
        break;
      }
    }

    if (headerRow >= 0) {
      break;
    }
  }

  if (
    headerRow < 0 ||
    applicationCol < 0
  ) {
    return {
      applications: null as number | null,
      reservations: null as number | null,
    };
  }

  /*
   * 일일합계 헤더 아래에서
   * '합계' 행을 찾는다.
   */
  for (
    let r = headerRow + 1;
    r < Math.min(
      rows.length,
      headerRow + 50
    );
    r++
  ) {
    const row = rows[r] ?? [];

    const hasTotalLabel =
      row.some((cell) => {
        const text =
          compactText(cell);

        return (
          text === "합계" ||
          text === "월합계" ||
          text === "총합"
        );
      });

    if (!hasTotalLabel) {
      continue;
    }

    const applications =
      intValue(
        row[applicationCol]
      );

    const reservations =
      intValue(
        row[reservationCol]
      );

    if (
      applications !== null ||
      reservations !== null
    ) {
      return {
        applications:
          applications ?? 0,

        reservations:
          reservations ?? 0,
      };
    }
  }

  return {
    applications: null as number | null,
    reservations: null as number | null,
  };
}


'''

    s = (
        s[:pos]
        + helper
        + s[pos:]
    )


# ============================================================
# 3. parseSheet 안에서 일일합계 읽기
# ============================================================

needle = '''  const dailyLayout = parseDailyPlatformLayout(rows, month);'''

if needle not in s:
    raise RuntimeError(
        "dailyLayout 호출 위치 못 찾음"
    )

if "const dailyGrandTotal =" not in s:
    s = s.replace(
        needle,
        needle
        + '''

  const dailyGrandTotal =
    parseExcelDailyGrandTotal(
      rows
    );''',
        1
    )


# ============================================================
# 4. parseSheet return에 일일합계 포함
# ============================================================

target = '''    dailyPlatforms: dailyLayout.dailyPlatforms,
'''

if target not in s:
    raise RuntimeError(
        "parseSheet return dailyPlatforms 못 찾음"
    )

if (
    "dailyTotalApplications: dailyGrandTotal.applications"
    not in s
):
    s = s.replace(
        target,
        target
        + '''    dailyTotalApplications:
      dailyGrandTotal.applications,
    dailyTotalReservations:
      dailyGrandTotal.reservations,
''',
        1
    )


# ============================================================
# 5. accumulator 초기값 추가
# ============================================================

target = '''    dailyMap: new Map(),'''

if target not in s:
    raise RuntimeError(
        "dailyMap 초기화 위치 못 찾음"
    )

# 해당 getAccumulator 블록 안에 아직 없는 경우
acc_pos = s.find(target)

near = s[
    acc_pos:
    acc_pos + 500
]

if "dailyTotalApplications:" not in near:
    s = s.replace(
        target,
        target
        + '''
    dailyTotalApplications: null,
    dailyTotalReservations: null,''',
        1
    )


# ============================================================
# 6. mergeCandidate에서 실제 Excel 합계 전달
# ============================================================

if (
    "candidate.dailyTotalApplications !== null"
    not in s
):
    marker = '''  for (const row of candidate.dailyPlatforms) {'''

    if marker not in s:
        raise RuntimeError(
            "mergeCandidate dailyPlatforms 위치 못 찾음"
        )

    block = '''  /*
   * Excel의 "일일 합계" 월 합계는
   * 재계산하지 않고 원본값 그대로 사용.
   */
  if (
    candidate.dailyTotalApplications !== null
  ) {
    accumulator.dailyTotalApplications =
      candidate.dailyTotalApplications;
  }

  if (
    candidate.dailyTotalReservations !== null
  ) {
    accumulator.dailyTotalReservations =
      candidate.dailyTotalReservations;
  }

'''

    s = s.replace(
        marker,
        block + marker,
        1
    )


# ============================================================
# 7. 이전에 넣은 잘못된 합계 계산 코드 제거하고
#    Excel 일일합계 원본을 최우선 사용
# ============================================================

pattern = re.compile(
    r'''
        const\s+(?:useDailyTotal[\s\S]*?\n\s*)?
        totalApplications\s*=
        [\s\S]*?
        const\s+totalReservations\s*=
        [\s\S]*?;
    ''',
    re.VERBOSE
)

replacement = '''        /*
         * 신청/예약 월 합계는
         * Excel의 "일일 합계" 합계행을 최우선 사용.
         *
         * 일일합계가 없는 오래된/다른 형식 파일만
         * 월간 플랫폼 합계로 fallback.
         */
        const totalApplications =
          item.dailyTotalApplications !== null
            ? item.dailyTotalApplications
            : platforms.reduce(
                (sum, row) =>
                  sum + row.applications,
                0
              );

        const totalReservations =
          item.dailyTotalReservations !== null
            ? item.dailyTotalReservations
            : platforms.reduce(
                (sum, row) =>
                  sum + row.reservations,
                0
              );
'''

new_s, count = pattern.subn(
    replacement,
    s,
    count=1
)

if count != 1:
    raise RuntimeError(
        "preview 합계 계산 블록 교체 실패"
    )

s = new_s


# ============================================================
# 8. preview 반환에도 필드 포함
# ============================================================

needle = '''          dailyPlatforms,
'''

# 최종 preview return 쪽 마지막 등장만 변경
idx = s.rfind(needle)

if idx < 0:
    raise RuntimeError(
        "preview return 위치 못 찾음"
    )

after = s[
    idx:
    idx + 300
]

if "dailyTotalApplications:" not in after:
    replacement = '''          dailyPlatforms,
          dailyTotalApplications:
            item.dailyTotalApplications,
          dailyTotalReservations:
            item.dailyTotalReservations,
'''

    s = (
        s[:idx]
        + s[idx:].replace(
            needle,
            replacement,
            1
        )
    )


p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("==============================================")
print(" EXCEL DAILY GRAND TOTAL PARSER INSTALLED")
print("==============================================")
print("월별 예외처리 제거")
print("일일합계 열 위치 자동 탐색")
print("Excel 합계행 원본 숫자 직접 사용")
print("")
print("예상:")
print("8월 686 / 472")
print("7월 782 / 503")
print("6월 681 / 525")
print("5월 747 / 611")
print("4월 872 / 657")
print("3월 749 / 561")
print("2월 565 / 428")
print("1월 961 / 594")
print("==============================================")
