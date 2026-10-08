from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_actual_chain_REAL_{stamp}")
shutil.copy2(p, bak)

# ==========================================================
# 1. MonthAccumulator 타입에 actualSurgeries 추가
# ==========================================================

m = re.search(
    r'type\s+MonthAccumulator\s*=\s*\{([\s\S]*?)\n\};',
    s
)

if not m:
    raise RuntimeError("MonthAccumulator 타입 못 찾음")

block = m.group(0)

if "actualSurgeries:" not in block:
    # consultations 바로 앞에 추가
    block_new, count = re.subn(
        r'(\n\s*consultations\s*:)',
        '\n  actualSurgeries: number | null;\\1',
        block,
        count=1
    )

    if count != 1:
        raise RuntimeError(
            "MonthAccumulator consultations 위치 못 찾음"
        )

    s = s[:m.start()] + block_new + s[m.end():]

print("OK 1/2: MonthAccumulator.actualSurgeries")


# ==========================================================
# 2. parseSheet return에서 actualSurgeries 전달
#
# 현재 실제:
# dailyConversions: dailyConversion.rows,
# doctorConversions,
#
# =>
# dailyConversions...
# actualSurgeries: dailyConversion.actualSurgeries ?? null,
# doctorConversions,
# ==========================================================

pattern = re.compile(
    r'(\n\s*dailyConversions\s*:\s*dailyConversion\.rows\s*,)'
    r'(\s*\n\s*doctorConversions\s*,)'
)

replacement = (
    r'\1'
    '\n    actualSurgeries:'
    '\n      dailyConversion.actualSurgeries ?? null,'
    r'\2'
)

s, count = pattern.subn(
    replacement,
    s,
    count=1
)

if count != 1:
    # 이미 들어가 있는지 확인
    if not re.search(
        r'dailyConversions\s*:\s*dailyConversion\.rows\s*,'
        r'[\s\S]{0,150}?'
        r'actualSurgeries\s*:\s*'
        r'dailyConversion\.actualSurgeries',
        s
    ):
        raise RuntimeError(
            "parseSheet return actualSurgeries 삽입 실패"
        )

print("OK 2/2: SheetCandidate actualSurgeries 전달")

p.write_text(s, encoding="utf-8")

print("")
print("=======================================")
print(" ACTUAL SURGERY CHAIN REAL FIX COMPLETE")
print("=======================================")
print("backup:", bak.name)
