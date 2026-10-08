from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("lib/db/schema.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_actual_surgeries_schema_{stamp}")
shutil.copy2(p, bak)

# 이미 있으면 아무것도 안 함
if re.search(
    r'actualSurgeries\s*:\s*integer\(\s*["\']actual_surgeries["\']',
    s
):
    print("actualSurgeries 이미 schema에 존재")
    raise SystemExit(0)

# dailyConversionStats 블록 찾기
start = s.find("export const dailyConversionStats")

if start < 0:
    raise RuntimeError(
        "dailyConversionStats 테이블을 못 찾음"
    )

# 다음 export const 전까지만 제한
end = s.find(
    "export const ",
    start + len("export const dailyConversionStats")
)

if end < 0:
    end = len(s)

block = s[start:end]

# consultations 필드 뒤에 actualSurgeries 삽입
pattern = re.compile(
    r'''(
        consultations\s*:\s*
        integer\(\s*["']consultations["']\s*\)
        [\s\S]*?
        ,\s*
    )''',
    re.VERBOSE
)

m = pattern.search(block)

if not m:
    raise RuntimeError(
        "dailyConversionStats의 consultations 필드를 못 찾음"
    )

insert = m.group(1) + '''
    actualSurgeries:
      integer("actual_surgeries")
        .notNull()
        .default(0),

'''

block = (
    block[:m.start()]
    + insert
    + block[m.end():]
)

s = s[:start] + block + s[end:]

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("======================================")
print(" SCHEMA ACTUAL SURGERIES ADDED")
print("======================================")
print('actualSurgeries -> "actual_surgeries"')
print("backup:", bak.name)
