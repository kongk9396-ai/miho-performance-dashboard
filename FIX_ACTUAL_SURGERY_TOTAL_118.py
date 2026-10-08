from pathlib import Path
from datetime import datetime
import shutil

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_actual_total_fix_{stamp}")
shutil.copy2(p, bak)

# =========================================================
# 1. parseDailyConversionLayout에 월 실제 수술 합계 변수 추가
# =========================================================

old = '''  let sheetTotalConsultations:
    number | null = null;

  let sheetTotalSurgeries:
    number | null = null;'''

new = '''  let sheetTotalActualSurgeries:
    number | null = null;

  let sheetTotalConsultations:
    number | null = null;

  let sheetTotalSurgeries:
    number | null = null;'''

if old not in s:
    raise RuntimeError("월 합계 변수 블록 못 찾음")

s = s.replace(old, new, 1)


# =========================================================
# 2. 월 합계 행에서 '수술 수'도 직접 읽기
# =========================================================

old = '''      sheetTotalConsultations =
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
        );'''

new = '''      sheetTotalActualSurgeries =
        intValue(
          row[
            actualSurgeryCol
          ]
        );

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
        );'''

if old not in s:
    raise RuntimeError("월 합계 읽기 블록 못 찾음")

s = s.replace(old, new, 1)


# =========================================================
# 3. return에 actualSurgeries 월 합계 포함
# =========================================================

old = '''  return {
    rows: dailyRows,

    consultations:
      dailyRows.length > 0
        ? consultations
        : null,

    surgeries:
      dailyRows.length > 0
        ? surgeries
        : null,'''

new = '''  const actualSurgeries =
    sheetTotalActualSurgeries !== null
      ? sheetTotalActualSurgeries
      : dailyRows.reduce(
          (sum, row) =>
            sum + Number(row.actualSurgeries ?? 0),
          0
        );

  return {
    rows: dailyRows,

    actualSurgeries:
      dailyRows.length > 0
        ? actualSurgeries
        : null,

    consultations:
      dailyRows.length > 0
        ? consultations
        : null,

    surgeries:
      dailyRows.length > 0
        ? surgeries
        : null,'''

if old not in s:
    raise RuntimeError("parseDailyConversionLayout return 블록 못 찾음")

s = s.replace(old, new, 1)


# =========================================================
# 4. 반환 타입을 쓰는 곳에서 dailyConversion.actualSurgeries 사용
# 기존 dailyConversions.reduce 합계 제거
# =========================================================

old = '''        const actualSurgeriesTotal =
          dailyConversions.reduce(
            (sum, row) =>
              sum +
              Number(
                row.actualSurgeries ?? 0
              ),
            0
          );'''

new = '''        /*
         * 수술 수는 일별 배열 재합산이 아니라
         * Excel 월 합계 행의 확정값 사용.
         */
        const actualSurgeriesTotal =
          item.actualSurgeries ?? 0;'''

if old not in s:
    raise RuntimeError("actualSurgeriesTotal 계산 블록 못 찾음")

s = s.replace(old, new, 1)


# =========================================================
# 5. SheetCandidate / MonthAccumulator / MonthPreview에
# actualSurgeries 월 합계 전달 필드 추가
# =========================================================

# 타입들에서 consultations 앞에 추가
for type_name in ["MonthPreview", "SheetCandidate"]:
    start = s.find(f"type {type_name} = {{")
    if start < 0:
        continue

    end = s.find("};", start)
    block = s[start:end]

    if "actualSurgeries:" not in block:
        marker = "  consultations:"
        pos = block.find(marker)

        if pos < 0:
            raise RuntimeError(f"{type_name} consultations 못 찾음")

        block = (
            block[:pos]
            + "  actualSurgeries: number | null;\n"
            + block[pos:]
        )

        s = s[:start] + block + s[end:]


# parseSheet return
old = '''    dailyConversions: dailyConversion.rows,
    consultations: conversion.consultations,'''

new = '''    dailyConversions: dailyConversion.rows,
    actualSurgeries:
      dailyConversion.actualSurgeries ?? null,
    consultations: conversion.consultations,'''

if old in s:
    s = s.replace(old, new, 1)


# accumulator 타입
start = s.find("type MonthAccumulator = {")
if start >= 0:
    end = s.find("};", start)
    block = s[start:end]

    if "actualSurgeries:" not in block:
        marker = "  consultations:"
        pos = block.find(marker)

        if pos >= 0:
            block = (
                block[:pos]
                + "  actualSurgeries: number | null;\n"
                + block[pos:]
            )
            s = s[:start] + block + s[end:]


# accumulator 초기값
if "actualSurgeries: null," not in s:
    marker = "    consultations: null,"
    pos = s.find(marker)

    if pos >= 0:
        s = s[:pos] + "    actualSurgeries: null,\n" + s[pos:]


# mergeCandidate에서 값 전달
if "candidate.actualSurgeries !== null" not in s:
    marker = '''  if (candidate.conversionScore > accumulator.conversionScore) {'''

    if marker not in s:
        raise RuntimeError("mergeCandidate conversionScore 위치 못 찾음")

    block = '''  if (candidate.actualSurgeries !== null) {
    accumulator.actualSurgeries =
      candidate.actualSurgeries;
  }

'''

    s = s.replace(marker, block + marker, 1)


p.write_text(s, encoding="utf-8")

print("")
print("======================================")
print(" ACTUAL SURGERY MONTH TOTAL FIXED")
print("======================================")
print("수술 수 = Excel 월 합계 행 직접 사용")
print("8월 기대값 = 118")
print("상담 = 329")
print("수술 결정 = 42")
print("전환율 = 12.77%")
print("backup:", bak.name)
