from pathlib import Path
from datetime import datetime
import shutil

ROOT = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard")
P = ROOT / "components/DashboardClient.tsx"
STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

shutil.copy2(P, Path(str(P) + f".bak_details_toggle_{STAMP}"))

s = P.read_text(encoding="utf-8")

# ============================================================
# React state
# ============================================================

# useState import가 없는 경우 React import에 추가
if "useState" not in s[:1000]:
    s = s.replace(
        'import React from "react";',
        'import React, { useState } from "react";',
        1
    )

# 컴포넌트 내부 기존 state 앞에 추가
if "showDailyConversionDetail" not in s:

    candidates = [
        "const [",
        "  const current",
        "  const dashboardData",
    ]

    insert = -1

    # 함수 선언 이후에서만 찾는다.
    component_positions = [
        s.find("export default function DashboardClient"),
        s.find("function DashboardClient"),
        s.find("const DashboardClient"),
    ]

    component_start = max(component_positions)

    if component_start < 0:
        raise SystemExit("DashboardClient 함수 시작점을 못 찾았습니다.")

    for needle in candidates:
        p = s.find(needle, component_start)
        if p >= 0:
            insert = p
            break

    if insert < 0:
        raise SystemExit("DashboardClient state 삽입 위치를 못 찾았습니다.")

    states = '''const [showDailyConversionDetail, setShowDailyConversionDetail] =
    useState(false);

  const [showDoctorConversionDetail, setShowDoctorConversionDetail] =
    useState(false);

  '''

    s = s[:insert] + states + s[insert:]

    print("OK: 상세보기 state 추가")


# ============================================================
# 일별 표 접기
# ============================================================

daily_empty = "일별 상담/수술전환 데이터가 없습니다"

if daily_empty not in s:
    raise SystemExit("일별 상세 영역을 못 찾았습니다.")

daily_empty_pos = s.find(daily_empty)

# 해당 상세 table의 가장 가까운 overflow-x-auto 찾기
daily_open = s.rfind(
    '<div className="mt-6 overflow-x-auto">',
    0,
    daily_empty_pos
)

if daily_open < 0:
    # 클래스 변형 대응
    daily_open = s.rfind(
        '<div className="overflow-x-auto">',
        0,
        daily_empty_pos
    )

if daily_open < 0:
    raise SystemExit("일별 상세 테이블 시작점을 못 찾았습니다.")

# 이 div의 닫힘을 JSX 구조상 empty 메시지 뒤에서 탐색
search_end = s.find("</article>", daily_empty_pos)

if search_end < 0:
    raise SystemExit("일별 article 끝을 못 찾았습니다.")

daily_region = s[daily_open:search_end]

if "showDailyConversionDetail" not in daily_region:

    # 상세 영역 시작 전에 토글 버튼
    button = '''<div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setShowDailyConversionDetail(
                              (value) => !value
                            )
                          }
                          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                        >
                          {showDailyConversionDetail
                            ? "접기 ▲"
                            : "상세보기 ▼"}
                        </button>
                      </div>

                      {showDailyConversionDetail && (
                        <>
'''

    s = s[:daily_open] + button + s[daily_open:]

    # 위치 다시 계산
    daily_empty_pos = s.find(daily_empty)
    search_end = s.find("</article>", daily_empty_pos)

    # article 끝 직전에는 상세 div가 닫힌 후 fragment/조건 닫기
    s = (
        s[:search_end]
        + '''                        </>
                      )}

'''
        + s[search_end:]
    )

    print("OK: 일별 상세보기 접기 추가")


# ============================================================
# 원장별 표 접기
# ============================================================

doctor_empty = "원장별 상담/수술 데이터가 없습니다."

if doctor_empty not in s:
    raise SystemExit("원장별 상세 영역을 못 찾았습니다.")

doctor_empty_pos = s.find(doctor_empty)

doctor_open = s.rfind(
    '<div className="mt-6 overflow-x-auto">',
    0,
    doctor_empty_pos
)

if doctor_open < 0:
    doctor_open = s.rfind(
        '<div className="overflow-x-auto">',
        0,
        doctor_empty_pos
    )

if doctor_open < 0:
    raise SystemExit("원장별 상세 테이블 시작점을 못 찾았습니다.")

doctor_article_end = s.find("</article>", doctor_empty_pos)

if doctor_article_end < 0:
    raise SystemExit("원장별 article 끝을 못 찾았습니다.")

doctor_region = s[doctor_open:doctor_article_end]

if "showDoctorConversionDetail" not in doctor_region:

    button = '''<div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setShowDoctorConversionDetail(
                              (value) => !value
                            )
                          }
                          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                        >
                          {showDoctorConversionDetail
                            ? "접기 ▲"
                            : "상세보기 ▼"}
                        </button>
                      </div>

                      {showDoctorConversionDetail && (
                        <>
'''

    s = s[:doctor_open] + button + s[doctor_open:]

    doctor_empty_pos = s.find(doctor_empty)
    doctor_article_end = s.find("</article>", doctor_empty_pos)

    s = (
        s[:doctor_article_end]
        + '''                        </>
                      )}

'''
        + s[doctor_article_end:]
    )

    print("OK: 원장별 상세보기 접기 추가")


P.write_text(s, encoding="utf-8")

print("")
print("========================================")
print(" DETAIL TOGGLE PATCH COMPLETE")
print("========================================")
print("✓ 일별 상세 기본 접힘")
print("✓ 일별 상세보기/접기")
print("✓ 원장별 상세 기본 접힘")
print("✓ 원장별 상세보기/접기")
print("backup:", STAMP)

