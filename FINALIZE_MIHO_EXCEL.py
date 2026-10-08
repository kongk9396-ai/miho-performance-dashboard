from pathlib import Path
from datetime import datetime
import shutil
import re

ROOT = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard")

PREVIEW = ROOT / "app/api/admin/import/preview/route.ts"
COMMIT = ROOT / "app/api/admin/import/commit/route.ts"

STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

for p in [PREVIEW, COMMIT]:
    shutil.copy2(
        p,
        Path(str(p) + f".bak_FINAL_CONVERSION_{STAMP}")
    )

print("BACKUP:", STAMP)

# ============================================================
# PREVIEW
# ============================================================

s = PREVIEW.read_text(encoding="utf-8-sig")


# ------------------------------------------------------------
# 1. Doctor 타입
# ------------------------------------------------------------

if "type DoctorConversionRow =" not in s:
    marker = "type MonthPreview = {"

    doctor_type = '''type DoctorConversionRow = {
  doctorName: string;
  reservations: number;
  consultations: number;
  surgeries: number;
};

'''

    if marker not in s:
        raise RuntimeError("MonthPreview 타입 위치 못 찾음")

    s = s.replace(
        marker,
        doctor_type + marker,
        1
    )


# ------------------------------------------------------------
# 2. MonthPreview / SheetCandidate / MonthAccumulator
# ------------------------------------------------------------

for type_name in ["MonthPreview", "SheetCandidate"]:
    pattern = re.compile(
        rf'(type {type_name} = \{{[\s\S]*?dailyConversions:\s*DailyConversionRow\[\];)'
    )

    m = pattern.search(s)

    if not m:
        raise RuntimeError(
            f"{type_name} dailyConversions 필드 못 찾음"
        )

    block = m.group(0)

    if "doctorConversions:" not in block:
        new_block = (
            block
            + "\n  doctorConversions: DoctorConversionRow[];"
        )

        s = (
            s[:m.start()]
            + new_block
            + s[m.end():]
        )


m = re.search(
    r'(type MonthAccumulator = \{[\s\S]*?dailyConversionMap:\s*Map<string,\s*DailyConversionRow>;\s*)',
    s
)

if not m:
    raise RuntimeError(
        "MonthAccumulator dailyConversionMap 못 찾음"
    )

if "doctorMap:" not in m.group(0):
    replacement = (
        m.group(1)
        + "  doctorMap: Map<string, DoctorConversionRow>;\n"
    )

    s = s[:m.start()] + replacement + s[m.end():]


# ------------------------------------------------------------
# 3. 진짜 MIHO 상담/수술 표 parser
#
# 핵심:
# 열 고정 X
# 시트 전체 헤더 탐색 X
#
# "상담 대비 수술 전환율" 제목을 찾은 다음
# 바로 그 블록의 헤더만 읽는다.
# ------------------------------------------------------------

if "function parseMihoDailyConversionFromWorksheet(" not in s:

    marker = "function parseDailyConversionLayout("

    pos = s.find(marker)

    if pos < 0:
        raise RuntimeError(
            "parseDailyConversionLayout 위치 못 찾음"
        )

    helper = r'''
function parseMihoDailyConversionFromWorksheet(
  worksheet: XLSX.WorkSheet,
  month: string
) {
  const result: DailyConversionRow[] = [];

  const range = XLSX.utils.decode_range(
    worksheet["!ref"] ?? "A1:A1"
  );

  const cellValue = (
    row: number,
    col: number
  ) =>
    worksheet[
      XLSX.utils.encode_cell({
        r: row,
        c: col,
      })
    ]?.v;

  /*
   * ① "상담 대비 수술 전환율" 제목 위치 탐색
   *
   * "원장님 수술 전환율" 블록은 제외.
   */
  let titleRow = -1;
  let titleCol = -1;

  outer:
  for (
    let r = range.s.r;
    r <= Math.min(range.e.r, range.s.r + 120);
    r++
  ) {
    for (
      let c = range.s.c;
      c <= range.e.c;
      c++
    ) {
      const text =
        compactText(
          cellValue(r, c)
        );

      if (
        text.includes("상담대비수술전환율") &&
        !text.includes("원장")
      ) {
        titleRow = r;
        titleCol = c;
        break outer;
      }
    }
  }

  if (
    titleRow < 0 ||
    titleCol < 0
  ) {
    return {
      rows: result,
      consultations: null as number | null,
      surgeries: null as number | null,
      score: 0,
    };
  }

  /*
   * ② 제목 바로 아래 헤더만 탐색.
   *
   * 월마다 블록 위치가 달라도 자동 대응.
   */
  const headerRow =
    titleRow + 1;

  let dateCol = -1;
  let consultationCol = -1;
  let conversionCol = -1;

  for (
    let c = titleCol;
    c <= Math.min(
      range.e.c,
      titleCol + 7
    );
    c++
  ) {
    const header =
      compactText(
        cellValue(
          headerRow,
          c
        )
      );

    if (
      header === "일자" ||
      header === "날짜"
    ) {
      dateCol = c;
    }

    if (
      header === "상담" ||
      header === "상담수" ||
      header === "상담건수"
    ) {
      consultationCol = c;
    }

    if (
      header === "수술전환" ||
      header === "수술전환수" ||
      header === "수술결정" ||
      header === "수술결정수"
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
      consultations: null as number | null,
      surgeries: null as number | null,
      score: 0,
    };
  }

  /*
   * ③ 실제 일별 행 읽기
   */
  for (
    let r = headerRow + 1;
    r <= range.e.r;
    r++
  ) {
    const rawDate =
      cellValue(
        r,
        dateCol
      );

    const marker =
      compactText(rawDate);

    if (
      marker === "월합계" ||
      marker === "합계" ||
      marker === "총합"
    ) {
      break;
    }

    const date =
      toDateString(
        rawDate,
        month
      );

    if (!date) {
      continue;
    }

    if (
      monthKey(date) !==
      monthKey(month)
    ) {
      continue;
    }

    /*
     * 쉬는 날/공휴일은 날짜만 있고
     * 상담·수술칸이 비어있을 수 있음.
     * 그 날짜도 0 / 0으로 저장.
     */
    const consultations =
      intValue(
        cellValue(
          r,
          consultationCol
        )
      ) ?? 0;

    const surgeries =
      intValue(
        cellValue(
          r,
          conversionCol
        )
      ) ?? 0;

    result.push({
      date,
      consultations,
      surgeries,
    });
  }

  /*
   * 날짜 중복 방어
   */
  const rows =
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

  const consultations =
    rows.reduce(
      (sum, row) =>
        sum +
        row.consultations,
      0
    );

  const surgeries =
    rows.reduce(
      (sum, row) =>
        sum +
        row.surgeries,
      0
    );

  return {
    rows,

    consultations:
      rows.length > 0
        ? consultations
        : null,

    surgeries:
      rows.length > 0
        ? surgeries
        : null,

    /*
     * 월 합계 parser보다 확실하게 우선.
     */
    score:
      rows.length > 0
        ? 9000 + rows.length
        : 0,
  };
}


/*
 * ==========================================
 * 원장별 월 상담 → 수술결정 parser
 * ==========================================
 */
function parseMihoDoctorConversionFromWorksheet(
  worksheet: XLSX.WorkSheet
): DoctorConversionRow[] {

  const range =
    XLSX.utils.decode_range(
      worksheet["!ref"] ??
        "A1:A1"
    );

  const cellValue = (
    row: number,
    col: number
  ) =>
    worksheet[
      XLSX.utils.encode_cell({
        r: row,
        c: col,
      })
    ]?.v;

  let titleRow = -1;
  let titleCol = -1;

  outer:
  for (
    let r = range.s.r;
    r <= Math.min(
      range.e.r,
      range.s.r + 120
    );
    r++
  ) {
    for (
      let c = range.s.c;
      c <= range.e.c;
      c++
    ) {
      const text =
        compactText(
          cellValue(r, c)
        );

      if (
        text.includes(
          "상담대비원장님수술전환율"
        ) ||
        text.includes(
          "원장님수술전환율"
        )
      ) {
        titleRow = r;
        titleCol = c;
        break outer;
      }
    }
  }

  /*
   * 예전 월은 원장표가 없을 수 있음.
   */
  if (
    titleRow < 0 ||
    titleCol < 0
  ) {
    return [];
  }

  const headerRow =
    titleRow + 1;

  let doctorCol = -1;
  let reservationCol = -1;
  let consultationCol = -1;
  let surgeryCol = -1;

  for (
    let c = titleCol;
    c <= Math.min(
      range.e.c,
      titleCol + 8
    );
    c++
  ) {
    const header =
      compactText(
        cellValue(
          headerRow,
          c
        )
      );

    if (
      header === "원장님" ||
      header === "원장" ||
      header === "원장명"
    ) {
      doctorCol = c;
    }

    if (
      header.includes(
        "상담예약"
      ) ||
      header.includes(
        "DB포함"
      )
    ) {
      reservationCol = c;
    }

    if (
      header === "실상담" ||
      header === "실제상담"
    ) {
      consultationCol = c;
    }

    if (
      header === "수술결정" ||
      header === "수술전환"
    ) {
      surgeryCol = c;
    }
  }

  if (
    doctorCol < 0 ||
    reservationCol < 0 ||
    consultationCol < 0 ||
    surgeryCol < 0
  ) {
    return [];
  }

  const map =
    new Map<
      string,
      DoctorConversionRow
    >();

  /*
   * S/J/T처럼 행 사이가 떨어져 있어도
   * 전부 훑어서 가져온다.
   */
  for (
    let r = headerRow + 1;
    r <= Math.min(
      range.e.r,
      headerRow + 120
    );
    r++
  ) {
    const doctorName =
      String(
        cellValue(
          r,
          doctorCol
        ) ?? ""
      ).trim();

    if (!doctorName) {
      continue;
    }

    const key =
      compactText(
        doctorName
      );

    if (
      key === "합계" ||
      key === "총계" ||
      key === "전체" ||
      key === "원장님"
    ) {
      continue;
    }

    const reservations =
      intValue(
        cellValue(
          r,
          reservationCol
        )
      );

    const consultations =
      intValue(
        cellValue(
          r,
          consultationCol
        )
      );

    const surgeries =
      intValue(
        cellValue(
          r,
          surgeryCol
        )
      );

    if (
      reservations === null &&
      consultations === null &&
      surgeries === null
    ) {
      continue;
    }

    map.set(
      doctorName,
      {
        doctorName,
        reservations:
          reservations ?? 0,
        consultations:
          consultations ?? 0,
        surgeries:
          surgeries ?? 0,
      }
    );
  }

  return Array.from(
    map.values()
  );
}


'''

    s = (
        s[:pos]
        + helper
        + s[pos:]
    )


# ------------------------------------------------------------
# 4. 기존 잘못된 daily parser를 우회
# ------------------------------------------------------------

pattern = re.compile(
    r'const\s+dailyConversion\s*=\s*parseDailyConversionLayout\(\s*rows\s*,\s*month\s*\)\s*;'
)

replacement = '''const dailyConversion =
    parseMihoDailyConversionFromWorksheet(
      worksheet,
      month
    );

  const doctorConversions =
    parseMihoDoctorConversionFromWorksheet(
      worksheet
    );'''

s, count = pattern.subn(
    replacement,
    s,
    count=1
)

if count != 1:
    raise RuntimeError(
        "parseSheet dailyConversion 호출 교체 실패"
    )


# ------------------------------------------------------------
# 5. parseSheet return에 doctorConversions
# ------------------------------------------------------------

target = '''    dailyConversions: dailyConversion.rows,
    consultations: conversion.consultations,'''

if target not in s:
    raise RuntimeError(
        "parseSheet return 위치 못 찾음"
    )

s = s.replace(
    target,
    '''    dailyConversions: dailyConversion.rows,
    doctorConversions,
    consultations: conversion.consultations,''',
    1
)


# ------------------------------------------------------------
# 6. accumulator doctorMap
# ------------------------------------------------------------

target = '''    dailyConversionMap: new Map(),'''

if target not in s:
    raise RuntimeError(
        "dailyConversionMap 초기화 위치 못 찾음"
    )

if "doctorMap: new Map()," not in s:
    s = s.replace(
        target,
        target +
        "\n    doctorMap: new Map(),",
        1
    )


# ------------------------------------------------------------
# 7. mergeCandidate → doctor
# ------------------------------------------------------------

if "candidate.doctorConversions" not in s:

    marker = '''  if (candidate.conversionScore > accumulator.conversionScore) {'''

    if marker not in s:
        raise RuntimeError(
            "mergeCandidate conversionScore 위치 못 찾음"
        )

    block = '''  for (
    const row of
    candidate.doctorConversions ?? []
  ) {
    accumulator.doctorMap.set(
      row.doctorName,
      row
    );
  }

'''

    s = s.replace(
        marker,
        block + marker,
        1
    )


# ------------------------------------------------------------
# 8. preview 결과에 doctorConversions 포함
# ------------------------------------------------------------

if "const doctorConversions = Array.from(item.doctorMap.values())" not in s:

    marker = '''        const totalApplications = platforms.reduce('''

    if marker not in s:
        raise RuntimeError(
            "preview totalApplications 위치 못 찾음"
        )

    block = '''        const doctorConversions =
          Array.from(
            item.doctorMap.values()
          ).sort(
            (a, b) =>
              a.doctorName.localeCompare(
                b.doctorName,
                "ko"
              )
          );

'''

    s = s.replace(
        marker,
        block + marker,
        1
    )

target = '''          dailyConversions,
          consultations: item.consultations,'''

if target not in s:
    raise RuntimeError(
        "preview return dailyConversions 위치 못 찾음"
    )

s = s.replace(
    target,
    '''          dailyConversions,
          doctorConversions,
          consultations: item.consultations,''',
    1
)


PREVIEW.write_text(
    s,
    encoding="utf-8"
)

print("PREVIEW PATCH OK")


# ============================================================
# COMMIT
# ============================================================

s = COMMIT.read_text(
    encoding="utf-8-sig"
)


# ------------------------------------------------------------
# 9. schema import
# ------------------------------------------------------------

if "doctorConversionStats" not in s:
    target = '''  dailyConversionStats,'''

    if target not in s:
        raise RuntimeError(
            "commit dailyConversionStats import 못 찾음"
        )

    s = s.replace(
        target,
        target +
        "\n  doctorConversionStats,",
        1
    )


# ------------------------------------------------------------
# 10. ImportMonth doctor 타입
# ------------------------------------------------------------

if "doctorConversions?:" not in s:

    m = re.search(
        r'(dailyConversions\?:\s*\{[\s\S]*?\}\[\];)',
        s
    )

    if not m:
        raise RuntimeError(
            "commit dailyConversions 타입 못 찾음"
        )

    block = '''

  doctorConversions?: {
    doctorName: string;
    reservations: number;
    consultations: number;
    surgeries: number;
  }[];
'''

    s = (
        s[:m.end()]
        + block
        + s[m.end():]
    )


# ------------------------------------------------------------
# 11. counter
# ------------------------------------------------------------

if "let doctorConversionRowsSaved = 0;" not in s:
    target = '''    let dailyConversionRowsSaved = 0;'''

    if target not in s:
        raise RuntimeError(
            "dailyConversionRowsSaved 못 찾음"
        )

    s = s.replace(
        target,
        target +
        "\n    let doctorConversionRowsSaved = 0;",
        1
    )


# ------------------------------------------------------------
# 12. 원장 DB 저장
# ------------------------------------------------------------

if "const incomingDoctorConversions =" not in s:

    marker = '''      const shouldWriteConversion ='''

    if marker not in s:
        raise RuntimeError(
            "shouldWriteConversion 위치 못 찾음"
        )

    block = r'''      /*
       * ======================================
       * 원장별 월 상담/수술전환 저장
       * ======================================
       */
      const incomingDoctorConversions =
        Array.isArray(
          monthData.doctorConversions
        )
          ? monthData.doctorConversions.filter(
              (row) =>
                row &&
                typeof row.doctorName ===
                  "string" &&
                row.doctorName.trim().length >
                  0
            )
          : [];

      if (
        incomingDoctorConversions.length >
        0
      ) {
        const doctorValues =
          incomingDoctorConversions.map(
            (row) => ({
              date: monthStart,

              doctorName:
                row.doctorName.trim(),

              reservations:
                safeNumber(
                  row.reservations
                ),

              consultations:
                safeNumber(
                  row.consultations
                ),

              surgeries:
                safeNumber(
                  row.surgeries
                ),
            })
          );

        await db
          .insert(
            doctorConversionStats
          )
          .values(
            doctorValues
          )
          .onConflictDoUpdate({
            target: [
              doctorConversionStats.date,
              doctorConversionStats.doctorName,
            ],

            set: {
              reservations:
                sql`excluded.reservations`,

              consultations:
                sql`excluded.consultations`,

              surgeries:
                sql`excluded.surgeries`,

              updatedAt:
                new Date(),
            },
          });

        doctorConversionRowsSaved +=
          doctorValues.length;

        wroteSomething = true;
      }

'''

    s = s.replace(
        marker,
        block + marker,
        1
    )


# ------------------------------------------------------------
# 13. 응답
# ------------------------------------------------------------

target = '''      dailyConversionRowsSaved,
      conversionMonthsSaved,'''

if target in s:
    s = s.replace(
        target,
        '''      dailyConversionRowsSaved,
      doctorConversionRowsSaved,
      conversionMonthsSaved,''',
        1
    )


COMMIT.write_text(
    s,
    encoding="utf-8"
)

print("COMMIT PATCH OK")

print("")
print("==============================================")
print(" FINAL MIHO EXCEL IMPORT PATCH COMPLETE")
print("==============================================")
print("✓ 월마다 이동하는 상담/수술 표 자동 탐색")
print("✓ 일별 상담")
print("✓ 일별 수술전환")
print("✓ 월 상담/수술 합계")
print("✓ 원장명")
print("✓ 상담예약(DB포함)")
print("✓ 실상담")
print("✓ 수술결정")
print("✓ doctor_conversion_stats 저장")
print("==============================================")
