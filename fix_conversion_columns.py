from pathlib import Path
from datetime import datetime
import shutil

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_fix_conversion_columns_{stamp}")
shutil.copy2(p, bak)

old = '''  let headerRow = -1;
  let dateCol = -1;
  let consultationCol = -1;
  let conversionCol = -1;

  for (let r = 0; r < Math.min(rows.length, 100); r++) {
    const row = rows[r] ?? [];

    let foundDate = -1;
    let foundConsult = -1;
    let foundConversion = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = compactText(row[c]);

      if (
        cell === "일자" ||
        cell === "날짜"
      ) {
        foundDate = c;
      }

      if (
        cell === "상담" ||
        cell === "상담수" ||
        cell === "상담건수" ||
        cell === "실상담"
      ) {
        foundConsult = c;
      }

      if (
        cell === "수술전환" ||
        cell === "수술전환수" ||
        cell === "수술결정" ||
        cell === "수술결정수"
      ) {
        foundConversion = c;
      }
    }

    if (
      foundDate >= 0 &&
      foundConsult >= 0 &&
      foundConversion >= 0
    ) {
      headerRow = r;
      dateCol = foundDate;
      consultationCol = foundConsult;
      conversionCol = foundConversion;
      break;
    }
  }'''

new = '''  let headerRow = -1;

  // MIHO 예약 변환율 Excel 고정 열
  // Y  = 일자          -> index 24
  // Z  = 수술 수       -> index 25 (사용 안 함)
  // AA = 상담          -> index 26
  // AB = 수술 전환     -> index 27
  // AC = 전환율        -> index 28
  const dateCol = 24;
  const consultationCol = 26;
  const conversionCol = 27;

  /*
   * 같은 시트 안에 일자/상담/수술 관련 표가 여러 개 있으므로
   * 전체 열을 자동 탐색하지 않는다.
   *
   * 반드시 Y/AA/AB가 각각
   * 일자/상담/수술전환인 헤더 행만 사용한다.
   */
  for (let r = 0; r < Math.min(rows.length, 100); r++) {
    const row = rows[r] ?? [];

    const dateHeader = compactText(row[dateCol]);
    const consultationHeader = compactText(row[consultationCol]);
    const conversionHeader = compactText(row[conversionCol]);

    const validDateHeader =
      dateHeader === "일자" ||
      dateHeader === "날짜";

    const validConsultationHeader =
      consultationHeader === "상담" ||
      consultationHeader === "상담수" ||
      consultationHeader === "상담건수";

    const validConversionHeader =
      conversionHeader === "수술전환" ||
      conversionHeader === "수술전환수" ||
      conversionHeader === "수술결정" ||
      conversionHeader === "수술결정수";

    if (
      validDateHeader &&
      validConsultationHeader &&
      validConversionHeader
    ) {
      headerRow = r;
      break;
    }
  }'''

if old not in s:
    raise RuntimeError(
        "기존 헤더 자동탐색 블록을 찾지 못했습니다. 파일 변경 안 함."
    )

s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

print("")
print("=======================================")
print(" CONVERSION COLUMN FIX COMPLETE")
print("=======================================")
print("Y  = 날짜")
print("AA = 상담")
print("AB = 수술전환")
print("backup:", bak.name)
