from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_consult_display_{stamp}")
shutil.copy2(p, bak)

start = s.find("상담 대비 수술 전환")
end = s.find("원장별 수술 전환율", start)

if start < 0 or end < 0:
    raise RuntimeError("섹션 경계 못 찾음")

before = s[:start]
section = s[start:end]
after = s[end:]

# =====================================================
# 위 '상담 대비 수술 전환' 화면 출력값만 월 확정값으로 통일
# =====================================================

replacements = [
    (
        "dailyConsultations.toLocaleString()",
        "current.consultations.toLocaleString()",
    ),
    (
        "dailySurgeries.toLocaleString()",
        "current.surgeries.toLocaleString()",
    ),
    (
        "totalConsultations.toLocaleString()",
        "current.consultations.toLocaleString()",
    ),
    (
        "totalSurgeries.toLocaleString()",
        "current.surgeries.toLocaleString()",
    ),
    (
        "totalRate.toFixed(2)",
        "current.surgeryRate.toFixed(2)",
    ),
    (
        "totalRate.toFixed(1)",
        "current.surgeryRate.toFixed(1)",
    ),
]

changed = []

for old, new in replacements:
    if old in section:
        section = section.replace(old, new)
        changed.append(old)

# 계산변수 자체도 월값으로 보정
section = section.replace(
    '''const totalConsultations =
                    hasDailyConversionData
                      ? dailyConsultations
                      : current.consultations;''',
    '''const totalConsultations =
                    current.consultations;'''
)

section = section.replace(
    '''const totalSurgeries =
                    hasDailyConversionData
                      ? dailySurgeries
                      : current.surgeries;''',
    '''const totalSurgeries =
                    current.surgeries;'''
)

# 혹시 위 형태가 이미 일부 변경되어 있어도
# daily 변수 자체를 JSX에서 못 쓰게 막는다.
section = section.replace(
    "{dailyConsultations}",
    "{current.consultations}"
)

section = section.replace(
    "{dailySurgeries}",
    "{current.surgeries}"
)

# 전환율 표시도 월 확정값 기준
section = section.replace(
    "{totalRate.toLocaleString()}",
    "{current.surgeryRate.toLocaleString()}"
)

s = before + section + after
p.write_text(s, encoding="utf-8")

print("")
print("======================================")
print(" CONSULT DISPLAY FORCE-SYNC COMPLETE")
print("======================================")
print("원장별 섹션: 수정 안 함")
print("상담 KPI -> current.consultations")
print("수술전환 KPI -> current.surgeries")
print("전환율 -> current.surgeryRate")
print("교체된 표현:", changed)
print("backup:", bak.name)
