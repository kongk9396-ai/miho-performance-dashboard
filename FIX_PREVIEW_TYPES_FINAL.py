from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_actual_type_final_{stamp}")
shutil.copy2(p, bak)

# =========================================================
# 1. DailyConversionRow.actualSurgeries를 optional로
#
# 활성 MIHO 파서는 실제 값을 넣지만,
# 예전 fallback parser는 해당 필드가 없을 수 있으므로
# 타입 오류만 방지.
# =========================================================

s, c1 = re.subn(
    r'actualSurgeries:\s*number;',
    'actualSurgeries?: number;',
    s,
    count=1
)

if c1 != 1:
    if "actualSurgeries?: number;" not in s:
        raise RuntimeError(
            "DailyConversionRow actualSurgeries 타입을 못 찾음"
        )

print("OK 1/2 DailyConversionRow 타입 수정")


# =========================================================
# 2. MonthPreview에 actualSurgeries 추가
# =========================================================

start = s.find("type MonthPreview = {")

if start < 0:
    raise RuntimeError("MonthPreview 타입 못 찾음")

end = s.find("};", start)

if end < 0:
    raise RuntimeError("MonthPreview 끝 못 찾음")

block = s[start:end]

if "actualSurgeries:" not in block:

    # consultations 앞에 추가
    marker = "consultations:"

    pos = block.find(marker)

    if pos < 0:
        raise RuntimeError(
            "MonthPreview consultations 필드 못 찾음"
        )

    line_start = block.rfind("\n", 0, pos) + 1

    block = (
        block[:line_start]
        + "  actualSurgeries: number;\n"
        + block[line_start:]
    )

    s = (
        s[:start]
        + block
        + s[end:]
    )

print("OK 2/2 MonthPreview actualSurgeries 추가")

p.write_text(s, encoding="utf-8")

print("")
print("======================================")
print(" PREVIEW TYPES FIXED")
print("======================================")
print("active parser actualSurgeries 유지")
print("fallback parser는 optional 허용")
print("MonthPreview actualSurgeries 추가")
print("backup:", bak.name)

