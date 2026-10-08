from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("components/ExcelImportManager.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_preview_actual_surgery_{stamp}")
shutil.copy2(p, bak)

# =========================================================
# 1. Preview 타입에 actualSurgeries 보장
# =========================================================

if "actualSurgeries:" not in s:
    # consultations 앞에 넣기
    s, count = re.subn(
        r'(\n\s*consultations:\s*number\s*\|\s*null;)',
        '\n  actualSurgeries: number;\\1',
        s,
        count=1
    )

    if count != 1:
        raise RuntimeError(
            "preview 타입에 actualSurgeries 추가 실패"
        )

print("OK 1/4 preview 타입")


# =========================================================
# 2. 헤더 교체
#
# 상담 | 수술 | 수술률
# ->
# 수술 수 | 상담 수 | 수술 결정 | 수술 전환율
# =========================================================

# 상담 헤더
s = re.sub(
    r'(<th[^>]*>\s*)상담(\s*</th>)',
    r'\1수술 수\2'
    + '\n'
    + r'\1상담 수\2',
    s,
    count=1
)

# 수술 헤더
s = re.sub(
    r'(<th[^>]*>\s*)수술(\s*</th>)',
    r'\1수술 결정\2',
    s,
    count=1
)

# 수술률 헤더
s = re.sub(
    r'(<th[^>]*>\s*)수술률(\s*</th>)',
    r'\1수술 전환율\2',
    s,
    count=1
)

print("OK 2/4 헤더")


# =========================================================
# 3. 상담 셀 앞에 actualSurgeries 셀 추가
# =========================================================

# month.consultations가 들어있는 td 찾기
match = re.search(
    r'''(<td[^>]*>\s*
         \{
           [^{}]*month\.consultations[^{}]*
         \}
         \s*</td>)''',
    s,
    re.VERBOSE
)

if not match:
    # JSX가 좀 다를 경우 넓게 탐색
    pos = s.find("month.consultations")

    if pos < 0:
        raise RuntimeError(
            "month.consultations 셀 못 찾음"
        )

    td_start = s.rfind("<td", 0, pos)
    td_end = s.find("</td>", pos)

    if td_start < 0 or td_end < 0:
        raise RuntimeError(
            "상담 td 범위 못 찾음"
        )

    td_end += len("</td>")
    consult_td = s[td_start:td_end]

    actual_td = re.sub(
        r'\{[\s\S]*?month\.consultations[\s\S]*?\}',
        '{month.actualSurgeries?.toLocaleString?.() ?? month.actualSurgeries ?? 0}',
        consult_td,
        count=1
    )

    s = (
        s[:td_start]
        + actual_td
        + "\n"
        + consult_td
        + s[td_end:]
    )

else:
    consult_td = match.group(1)

    actual_td = re.sub(
        r'\{[\s\S]*?\}',
        '{month.actualSurgeries?.toLocaleString?.() ?? month.actualSurgeries ?? 0}',
        consult_td,
        count=1
    )

    s = (
        s[:match.start()]
        + actual_td
        + "\n"
        + consult_td
        + s[match.end():]
    )

print("OK 3/4 수술 수 셀")


# =========================================================
# 4. 현재 표시명 정리
# =========================================================

# 행 값은:
# actualSurgeries / consultations / surgeries / surgeryRate
#
# surgeries는 "수술 결정"
# surgeryRate는 "수술 전환율"
#
# 숫자 로직은 그대로 사용

print("OK 4/4 값 구조 유지")

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("====================================")
print(" IMPORT PREVIEW UI FIXED")
print("====================================")
print("미리보기:")
print("수술 수 | 상담 수 | 수술 결정 | 수술 전환율")
print("")
print("8월 목표:")
print("118 | 329 | 42 | 12.77%")
print("backup:", bak.name)
print("====================================")
