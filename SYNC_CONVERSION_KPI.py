from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_sync_conversion_kpi_{stamp}")
shutil.copy2(p, bak)

# 상담 대비 수술 전환 섹션만 제한
start = s.find("상담 대비 수술 전환")
end = s.find("원장별 수술 전환율", start)

if start < 0 or end < 0:
    raise RuntimeError("섹션 범위를 못 찾음")

section = s[start:end]

# 기존:
# const totalConsultations =
#   hasDailyConversionData
#     ? dailyConsultations
#     : current.consultations;
#
# 을 무조건 월 확정값으로 변경

section, c1 = re.subn(
    r'''const\s+totalConsultations\s*=
        \s*hasDailyConversionData
        \s*\?\s*dailyConsultations
        \s*:\s*current\.consultations\s*;''',
    '''const totalConsultations =
                    current.consultations;''',
    section,
    count=1,
    flags=re.VERBOSE
)

section, c2 = re.subn(
    r'''const\s+totalSurgeries\s*=
        \s*hasDailyConversionData
        \s*\?\s*dailySurgeries
        \s*:\s*current\.surgeries\s*;''',
    '''const totalSurgeries =
                    current.surgeries;''',
    section,
    count=1,
    flags=re.VERBOSE
)

# 혹시 현재 코드가 dashboardData.current 형태면 대응
if c1 == 0:
    section, c1 = re.subn(
        r'''const\s+totalConsultations\s*=
            [\s\S]*?
            current\.consultations\s*;''',
        '''const totalConsultations =
                    current.consultations;''',
        section,
        count=1,
        flags=re.VERBOSE
    )

if c2 == 0:
    section, c2 = re.subn(
        r'''const\s+totalSurgeries\s*=
            [\s\S]*?
            current\.surgeries\s*;''',
        '''const totalSurgeries =
                    current.surgeries;''',
        section,
        count=1,
        flags=re.VERBOSE
    )

if c1 != 1 or c2 != 1:
    raise RuntimeError(
        f"교체 실패 consultations={c1}, surgeries={c2}"
    )

s = s[:start] + section + s[end:]

p.write_text(s, encoding="utf-8")

print("")
print("====================================")
print(" CONVERSION KPI SYNC COMPLETE")
print("====================================")
print("위 KPI와 아래 상담 대비 수술 전환")
print("동일한 월 확정값 사용")
print("")
print("8월 예상:")
print("상담       329")
print("수술 전환   42")
print("전환율     12.77%")
print("====================================")
print("backup:", bak.name)
