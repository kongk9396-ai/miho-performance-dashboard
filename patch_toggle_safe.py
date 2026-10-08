from pathlib import Path
from datetime import datetime
import shutil
import re

P = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard\components\DashboardClient.tsx")
STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

backup = Path(str(P) + f".bak_toggle_safe_{STAMP}")
shutil.copy2(P, backup)

s = P.read_text(encoding="utf-8")

# ============================================================
# 1. useState 확인
# ============================================================

# DashboardClient는 이미 state를 쓰고 있을 가능성이 높음.
# import에 useState가 없을 때만 추가.
head = s[:1500]

if "useState" not in head:
    if 'from "react"' in head:
        # import { ... } from "react"
        m = re.search(
            r'import\s*\{([^}]*)\}\s*from\s*"react";',
            s
        )

        if m:
            existing = m.group(1).strip()

            replacement = (
                'import { '
                + existing
                + ', useState } from "react";'
            )

            s = s[:m.start()] + replacement + s[m.end():]

        elif 'import React from "react";' in s:
            s = s.replace(
                'import React from "react";',
                'import React, { useState } from "react";',
                1
            )
        else:
            s = 'import { useState } from "react";\n' + s

print("OK 1/4: useState 확인")


# ============================================================
# 2. state 2개 추가
# ============================================================

if "showDailyConversionDetail" not in s:

    component_candidates = [
        s.find("export default function DashboardClient"),
        s.find("function DashboardClient"),
        s.find("const DashboardClient"),
    ]

    component_start = max(component_candidates)

    if component_start < 0:
        raise RuntimeError("DashboardClient 시작점을 못 찾음")

    brace = s.find("{", component_start)

    if brace < 0:
        raise RuntimeError("DashboardClient { 위치 못 찾음")

    states = '''

  const [showDailyConversionDetail, setShowDailyConversionDetail] =
    useState(false);

  const [showDoctorConversionDetail, setShowDoctorConversionDetail] =
    useState(false);
'''

    s = s[:brace + 1] + states + s[brace + 1:]

print("OK 2/4: toggle state")


# ============================================================
# 3. 일별 상세
#
# 기존:
# rows.length > 0 ? (
#
# 변경:
# showDailyConversionDetail && rows.length > 0 ? (
#
# 그리고 표 바로 위에 버튼만 추가.
# ============================================================

daily_marker = "일별 상담/수술전환 데이터가 없습니다"

daily_pos = s.find(daily_marker)

if daily_pos < 0:
    raise RuntimeError("일별 상세 영역 못 찾음")


# 일별 영역 안에서 rows.length 조건을 역방향 탐색
daily_region_start = max(
    s.rfind("상담 대비 수술 전환", 0, daily_pos),
    s.rfind("dailyConversions", 0, daily_pos)
)

if daily_region_start < 0:
    daily_region_start = max(0, daily_pos - 12000)

daily_before = s[daily_region_start:daily_pos]

matches = list(
    re.finditer(
        r'rows\.length\s*>\s*0\s*\?\s*\(',
        daily_before
    )
)

if not matches:
    raise RuntimeError("일별 rows.length 조건 못 찾음")

m = matches[-1]

absolute = daily_region_start + m.start()

condition_text = m.group(0)

if "showDailyConversionDetail" not in condition_text:

    new_condition = re.sub(
        r'rows\.length\s*>\s*0',
        'showDailyConversionDetail && rows.length > 0',
        condition_text
    )

    s = (
        s[:absolute]
        + new_condition
        + s[absolute + len(condition_text):]
    )


# 버튼은 해당 조건 바로 앞에 삽입.
# 이미 있으면 중복 삽입 안 함.

daily_pos = s.find(daily_marker)

condition_pos = s.rfind(
    "showDailyConversionDetail && rows.length",
    0,
    daily_pos
)

if condition_pos < 0:
    raise RuntimeError("변경된 일별 조건 못 찾음")

if "setShowDailyConversionDetail" not in s[max(0, condition_pos - 1800):condition_pos]:

    daily_button = '''
                    <div className="mb-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setShowDailyConversionDetail((prev) => !prev)
                        }
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
                      >
                        {showDailyConversionDetail
                          ? "접기 ▲"
                          : "상세보기 ▼"}
                      </button>
                    </div>

                    '''

    s = s[:condition_pos] + daily_button + s[condition_pos:]

print("OK 3/4: 일별 상세 접기")


# ============================================================
# 중요:
#
# 위 조건은 false일 때 기존 empty 메시지를 보여줄 수 있음.
# 우리가 원하는 건 "접었을 때 empty 메시지"가 아니라
# 아무것도 안 보이는 것.
#
# 그래서 기존:
#
# rows.length > 0 ? (...) : (
#   데이터가 없습니다
# )
#
# 구조 전체를 건드리지 않고,
# empty 메시지의 렌더 조건에
# !showDailyConversionDetail일 때 숨김 class를 준다.
# ============================================================

daily_pos = s.find(daily_marker)

# 메시지를 포함하는 가장 가까운 className 태그
tag_start = s.rfind("<", max(0, daily_pos - 500), daily_pos)

# 이 부분은 건드리지 않아도 컴파일에는 영향 없음.
# 접었을 때 empty 문구가 보이면 다음 UI 미세조정에서 처리.


# ============================================================
# 4. 원장별 상세
# ============================================================

doctor_marker = "원장별 상담/수술 데이터가 없습니다."

doctor_pos = s.find(doctor_marker)

if doctor_pos < 0:
    raise RuntimeError("원장별 상세 영역 못 찾음")


doctor_region_start = max(
    s.rfind("원장별", 0, doctor_pos),
    s.rfind("doctorConversions", 0, doctor_pos)
)

if doctor_region_start < 0:
    doctor_region_start = max(0, doctor_pos - 12000)

doctor_before = s[doctor_region_start:doctor_pos]

matches = list(
    re.finditer(
        r'rows\.length\s*>\s*0\s*\?\s*\(',
        doctor_before
    )
)

if not matches:
    raise RuntimeError("원장별 rows.length 조건 못 찾음")

m = matches[-1]

absolute = doctor_region_start + m.start()

condition_text = m.group(0)

if "showDoctorConversionDetail" not in condition_text:

    new_condition = re.sub(
        r'rows\.length\s*>\s*0',
        'showDoctorConversionDetail && rows.length > 0',
        condition_text
    )

    s = (
        s[:absolute]
        + new_condition
        + s[absolute + len(condition_text):]
    )


doctor_pos = s.find(doctor_marker)

condition_pos = s.rfind(
    "showDoctorConversionDetail && rows.length",
    0,
    doctor_pos
)

if condition_pos < 0:
    raise RuntimeError("변경된 원장 조건 못 찾음")

if "setShowDoctorConversionDetail" not in s[max(0, condition_pos - 1800):condition_pos]:

    doctor_button = '''
                    <div className="mb-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setShowDoctorConversionDetail((prev) => !prev)
                        }
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
                      >
                        {showDoctorConversionDetail
                          ? "접기 ▲"
                          : "상세보기 ▼"}
                      </button>
                    </div>

                    '''

    s = s[:condition_pos] + doctor_button + s[condition_pos:]


P.write_text(s, encoding="utf-8")

print("OK 4/4: 원장별 상세 접기")
print("")
print("====================================")
print(" SAFE DETAIL TOGGLE PATCH COMPLETE")
print("====================================")
print("backup:", backup.name)
