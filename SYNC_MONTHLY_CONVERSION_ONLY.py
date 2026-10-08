from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_SYNC_MONTHLY_{stamp}")
shutil.copy2(p, bak)

# 상담 대비 수술 전환 섹션만 제한
start = s.find("상담 대비 수술 전환")
end = s.find("원장별 수술 전환율", start)

if start < 0 or end < 0:
    raise RuntimeError("섹션 경계를 못 찾음")

before = s[:start]
section = s[start:end]
after = s[end:]

# 현재 실제 코드:
# const totalConsultations =
#   hasDailyConversionData
#     ? dailyConsultations
#     : current.consultations;
#
# → 무조건 월 확정값 사용

section, c1 = re.subn(
    r'''const\s+totalConsultations\s*=
\s*hasDailyConversionData
\s*\?\s*dailyConsultations
\s*:\s*current\.consultations\s*;''',
    '''const totalConsultations =
                    current.consultations;''',
    section,
    count=1
)

section, c2 = re.subn(
    r'''const\s+totalSurgeries\s*=
\s*hasDailyConversionData
\s*\?\s*dailySurgeries
\s*:\s*current\.surgeries\s*;''',
    '''const totalSurgeries =
                    current.surgeries;''',
    section,
    count=1
)

if c1 != 1:
    raise RuntimeError(
        f"totalConsultations 교체 실패: {c1}"
    )

if c2 != 1:
    raise RuntimeError(
        f"totalSurgeries 교체 실패: {c2}"
    )

s = before + section + after
p.write_text(s, encoding="utf-8")

print("")
print("======================================")
print(" MONTHLY CONVERSION KPI SYNCED")
print("======================================")
print("상담       = current.consultations")
print("수술 전환  = current.surgeries")
print("8월 기대   = 329 / 42 / 12.77%")
print("backup:", bak.name)
