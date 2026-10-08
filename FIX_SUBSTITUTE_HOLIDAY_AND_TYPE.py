from pathlib import Path
from datetime import datetime
import shutil
import re

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

# ============================================================
# 1. commit/route.ts - ImportMonth actualSurgeries 타입 보정
# ============================================================

commit_path = Path("app/api/admin/import/commit/route.ts")
commit = commit_path.read_text(encoding="utf-8-sig")

shutil.copy2(
    commit_path,
    Path(str(commit_path) + f".bak_typefix_{stamp}")
)

m = re.search(
    r'type\s+ImportMonth\s*=\s*\{([\s\S]*?)\n\};',
    commit
)

if not m:
    raise RuntimeError("ImportMonth 타입을 못 찾음")

block = m.group(0)

# top-level month 바로 뒤에 actualSurgeries가 있는지 확인
if not re.search(
    r'month\s*:\s*string\s*;\s*\n\s*actualSurgeries\??\s*:\s*number\s*;',
    block
):
    block_new, count = re.subn(
        r'(month\s*:\s*string\s*;)',
        r'\1\n  actualSurgeries?: number;',
        block,
        count=1
    )

    if count != 1:
        raise RuntimeError("ImportMonth.month 위치 못 찾음")

    commit = (
        commit[:m.start()]
        + block_new
        + commit[m.end():]
    )

commit_path.write_text(
    commit,
    encoding="utf-8"
)

print("OK 1/2 ImportMonth.actualSurgeries 타입 수정")


# ============================================================
# 2. ManualConversionManager.tsx
#    대체공휴일 제외
# ============================================================

ui_path = Path("components/ManualConversionManager.tsx")
ui = ui_path.read_text(encoding="utf-8-sig")

shutil.copy2(
    ui_path,
    Path(str(ui_path) + f".bak_substitute_holiday_{stamp}")
)

# getHolidays(year) 뒤의 public filter를
# substitute holiday 제외 필터로 교체
pattern = re.compile(
    r'\.filter\(\s*'
    r'(?:\(\s*holiday\s*\)|holiday)\s*=>\s*'
    r'holiday\.type\s*===\s*["\']public["\']'
    r'\s*\)',
    re.MULTILINE
)

replacement = '''.filter(
        (holiday) =>
          holiday.type === "public" &&
          holiday.substitute !== true &&
          !/대체|substitute/i.test(
            String(holiday.name ?? "")
          )
      )'''

ui, count = pattern.subn(
    replacement,
    ui,
    count=1
)

if count == 0:
    # 이미 복잡한 filter가 들어간 경우 해당 getHolidays 블록을 강제로 보정
    start = ui.find("krHolidays")
    get_pos = ui.find(".getHolidays(year)", start)

    if get_pos < 0:
        raise RuntimeError("getHolidays(year) 위치 못 찾음")

    filter_start = ui.find(".filter(", get_pos)
    map_start = ui.find(".map(", filter_start)

    if filter_start < 0 or map_start < 0:
        raise RuntimeError("holiday filter/map 위치 못 찾음")

    new_filter = '''.filter(
        (holiday) =>
          holiday.type === "public" &&
          holiday.substitute !== true &&
          !/대체|substitute/i.test(
            String(holiday.name ?? "")
          )
      )
      '''

    ui = (
        ui[:filter_start]
        + new_filter
        + ui[map_start:]
    )

ui_path.write_text(
    ui,
    encoding="utf-8"
)

print("OK 2/2 대체공휴일 제외")
print("")
print("====================================")
print(" 휴일 기준")
print("====================================")
print("일요일       -> 회색 + 입력 잠금")
print("실제 공휴일  -> 회색 + 입력 잠금")
print("대체공휴일   -> 정상 입력")
print("토요일       -> 정상 입력")
print("====================================")
