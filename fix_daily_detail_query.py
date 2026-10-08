from pathlib import Path
from datetime import datetime
import shutil
import re

ROOT = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard")
P = ROOT / "lib/db/queries.ts"
STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

shutil.copy2(P, Path(str(P) + f".bak_daily_detail_{STAMP}"))

s = P.read_text(encoding="utf-8")

# ==========================================================
# dailyConversions의 잘못된 monthFromDate 비교 제거
# DB query 자체가 이미 queryStartDate ~ queryNextDate 범위이므로
# 여기서 다시 month 필터링할 필요가 없다.
# ==========================================================

pattern = re.compile(
    r'''const\s+dailyConversions\s*=\s*
\s*dailyConversionRows\s*
\s*\.filter\(\s*
\s*\(row\)\s*=>\s*
[\s\S]*?
\s*\)\s*
\s*\.map\(\(row\)\s*=>\s*\(\{''',
    re.MULTILINE
)

m = pattern.search(s)

if not m:
    # 현재 코드 변형 대응: dailyConversions 시작~map 사이만 직접 탐색
    start = s.find("const dailyConversions =")

    if start < 0:
        raise SystemExit("dailyConversions 시작점을 못 찾았습니다.")

    map_pos = s.find(".map((row) => ({", start)

    if map_pos < 0:
        raise SystemExit("dailyConversions .map 위치를 못 찾았습니다.")

    prefix = s[start:map_pos]

    if ".filter(" not in prefix:
        print("dailyConversions에 추가 month filter가 이미 없습니다. SKIP")
    else:
        new_prefix = """const dailyConversions =
    dailyConversionRows
      """

        s = s[:start] + new_prefix + s[map_pos:]
        print("OK: dailyConversions 월 재필터 제거")
else:
    replacement = """const dailyConversions =
    dailyConversionRows
      .map((row) => ({"""

    s = s[:m.start()] + replacement + s[m.end():]
    print("OK: dailyConversions 월 재필터 제거")


# ==========================================================
# doctorDailyConversions도 같은 방식으로 수정
# ==========================================================

start = s.find("const doctorDailyConversions =")

if start >= 0:
    map_pos = s.find(".map((row) =>", start)

    if map_pos >= 0:
        prefix = s[start:map_pos]

        if ".filter(" in prefix:
            new_prefix = """const doctorDailyConversions =
    doctorConversionRows
      """

            s = s[:start] + new_prefix + s[map_pos:]
            print("OK: doctorDailyConversions 월 재필터 제거")


P.write_text(s, encoding="utf-8")

print("")
print("======================================")
print(" DAILY DETAIL QUERY PATCH COMPLETE")
print("======================================")
print("backup:", STAMP)
