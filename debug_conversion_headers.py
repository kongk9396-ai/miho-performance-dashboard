from pathlib import Path
import re

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

# 혹시 이전 DEBUG가 이미 들어갔다면 중복 삽입 방지
if "CONVERSION HEADER DEBUG" in s:
    print("DEBUG 로그가 이미 들어가 있음")
    raise SystemExit(0)

pattern = r'(function\s+parseDailyConversionLayout\s*\(\s*rows:\s*unknown\[\]\[\],\s*month:\s*string\s*\)\s*\{)'

debug = r'''
  console.log("========== CONVERSION HEADER DEBUG ==========");
  console.log("MONTH:", month);

  for (let debugR = 0; debugR < Math.min(rows.length, 100); debugR++) {
    const debugRow = rows[debugR] ?? [];

    const hits = debugRow
      .map((value, index) => {
        let n = index + 1;
        let excelCol = "";

        while (n > 0) {
          const rem = (n - 1) % 26;
          excelCol = String.fromCharCode(65 + rem) + excelCol;
          n = Math.floor((n - 1) / 26);
        }

        return {
          index,
          excelCol,
          value: compactText(value),
        };
      })
      .filter(({ value }) =>
        value.includes("일자") ||
        value.includes("날짜") ||
        value.includes("상담") ||
        value.includes("수술")
      );

    if (hits.length > 0) {
      console.log(
        "ROW",
        debugR + 1,
        JSON.stringify(hits)
      );
    }
  }

  console.log("=============================================");
'''

new_s, count = re.subn(
    pattern,
    lambda m: m.group(1) + debug,
    s,
    count=1,
    flags=re.MULTILINE
)

if count != 1:
    raise RuntimeError(
        f"함수 선언 탐색 실패: count={count}"
    )

p.write_text(new_s, encoding="utf-8")

print("DEBUG PATCH OK")
