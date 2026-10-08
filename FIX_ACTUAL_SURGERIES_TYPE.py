from pathlib import Path
from datetime import datetime
import shutil

FILES = [
    Path("components/DashboardClient.tsx"),
    Path("lib/db/queries.ts"),
]

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

for p in FILES:
    shutil.copy2(
        p,
        Path(str(p) + f".bak_actual_surgery_typefix_{stamp}")
    )

# =========================================================
# 1. DashboardClient.tsx
# =========================================================

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

# dailyConversions 타입에 actualSurgeries 추가
old = '''  dailyConversions: {
    date: string;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];'''

new = '''  dailyConversions: {
    date: string;
    actualSurgeries?: number;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];'''

if old in s:
    s = s.replace(old, new, 1)
    print("OK 1: Dashboard 타입 actualSurgeries 추가")
elif "actualSurgeries?: number;" in s or "actualSurgeries: number;" in s:
    print("OK 1: Dashboard 타입 이미 존재")
else:
    raise RuntimeError(
        "DashboardData.dailyConversions 타입 블록을 못 찾음"
    )

# runtime crash 방지
s = s.replace(
    "{row.actualSurgeries.toLocaleString()}",
    "{Number(row.actualSurgeries ?? 0).toLocaleString()}"
)

p.write_text(s, encoding="utf-8")

print("OK 2: undefined 안전 출력 적용")


# =========================================================
# 2. lib/db/queries.ts
# daily_conversion_stats에서 actualSurgeries까지 조회
# =========================================================

p = Path("lib/db/queries.ts")
s = p.read_text(encoding="utf-8-sig")

# select
old_select = '''          consultations: dailyConversionStats.consultations,
          surgeries: dailyConversionStats.surgeries,'''

new_select = '''          actualSurgeries: dailyConversionStats.actualSurgeries,
          consultations: dailyConversionStats.consultations,
          surgeries: dailyConversionStats.surgeries,'''

if "actualSurgeries: dailyConversionStats.actualSurgeries" not in s:
    if old_select not in s:
        raise RuntimeError(
            "dailyConversionStats SELECT 위치 못 찾음"
        )

    s = s.replace(
        old_select,
        new_select,
        1
    )

    print("OK 3: DB SELECT actualSurgeries 추가")
else:
    print("OK 3: DB SELECT 이미 존재")


# dashboard dailyConversions 반환
old_map = '''        date: row.date,
        consultations: row.consultations,
        surgeries: row.surgeries,
        rate:'''

new_map = '''        date: row.date,
        actualSurgeries:
          Number(row.actualSurgeries ?? 0),
        consultations: row.consultations,
        surgeries: row.surgeries,
        rate:'''

if "Number(row.actualSurgeries ?? 0)" not in s:
    if old_map not in s:
        raise RuntimeError(
            "dailyConversions map 위치 못 찾음"
        )

    s = s.replace(
        old_map,
        new_map,
        1
    )

    print("OK 4: dashboard 반환 actualSurgeries 추가")
else:
    print("OK 4: dashboard 반환 이미 존재")

p.write_text(s, encoding="utf-8")

print("")
print("======================================")
print(" ACTUAL SURGERIES TYPE FIX COMPLETE")
print("======================================")
print("원장별 영역: 수정 안 함")
print("상담/수술결정 계산: 수정 안 함")
print("actualSurgeries 타입/조회/안전출력만 수정")
print("======================================")
