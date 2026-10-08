from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_remove_old_daily_{stamp}")
shutil.copy2(p, bak)

TARGET = "일별 상담 · 수술 현황"

title_pos = s.find(TARGET)

if title_pos < 0:
    raise RuntimeError(
        "구형 '일별 상담 · 수술 현황' 영역을 찾지 못했습니다."
    )

# 제목이 포함된 section 시작점
section_start = s.rfind("<section", 0, title_pos)

if section_start < 0:
    raise RuntimeError("구형 section 시작점을 찾지 못했습니다.")

# 바로 다음 section 시작점
next_section = s.find("<section", title_pos + len(TARGET))

if next_section < 0:
    raise RuntimeError(
        "다음 section을 찾지 못했습니다. 안전을 위해 삭제하지 않습니다."
    )

old_block = s[section_start:next_section]

# 실수로 새 영역까지 잡았는지 안전 검사
if "상담 대비 수술 전환" in old_block:
    raise RuntimeError(
        "새 상담 대비 수술 전환 영역까지 범위에 포함됨. 삭제 중단."
    )

if TARGET not in old_block:
    raise RuntimeError("삭제 대상 검증 실패.")

s = s[:section_start] + s[next_section:]

p.write_text(s, encoding="utf-8")

print("")
print("======================================")
print(" OLD DAILY SECTION REMOVED")
print("======================================")
print("삭제:", TARGET)
print("유지: 상담 대비 수술 전환")
print("backup:", bak.name)
