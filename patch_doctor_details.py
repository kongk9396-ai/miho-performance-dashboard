from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_doctor_details_{stamp}")
shutil.copy2(p, bak)

print("BACKUP:", bak)

# ============================================================
# 원장별 영역 찾기
# ============================================================

# 실제 doctorConversions 사용 위치 기준
section = s.find("dashboardData.doctorConversions")

if section < 0:
    raise RuntimeError(
        "dashboardData.doctorConversions 영역을 못 찾았습니다."
    )

# 해당 코드보다 앞에 있는 article 시작점을 찾음
article_start = s.rfind("<article", 0, section)

if article_start < 0:
    raise RuntimeError("원장별 article 시작점을 못 찾았습니다.")

# 다음 article/section까지만 원장 영역으로 제한
next_section = s.find("<section", section + 1)

if next_section < 0:
    next_section = len(s)

# ============================================================
# 원장별 실제 테이블 시작
# ============================================================

table_token = '<table className="w-full min-w-[760px] text-sm">'

table_pos = s.find(
    table_token,
    section,
    next_section
)

if table_pos < 0:
    raise RuntimeError(
        "원장별 760px 테이블을 못 찾았습니다."
    )

# table 바로 앞 wrapper div
div_start = s.rfind(
    '<div className="mt-6 overflow-x-auto">',
    section,
    table_pos
)

if div_start < 0:
    div_start = s.rfind(
        '<div className="mt-4 overflow-x-auto">',
        section,
        table_pos
    )

if div_start < 0:
    raise RuntimeError(
        "원장별 테이블 wrapper를 못 찾았습니다."
    )

# ============================================================
# 원장별 테이블 끝
# ============================================================

empty_text = "원장별 상담/수술 데이터가 없습니다."

empty_pos = s.find(
    empty_text,
    table_pos,
    next_section
)

if empty_pos < 0:
    raise RuntimeError(
        "원장별 데이터 없음 문구를 못 찾았습니다."
    )

# empty 메시지 div 닫기
empty_close = s.find(
    "</div>",
    empty_pos,
    next_section
)

if empty_close < 0:
    raise RuntimeError(
        "원장별 empty div 종료를 못 찾았습니다."
    )

# 그 다음 wrapper div 닫기
wrapper_close = s.find(
    "</div>",
    empty_close + len("</div>"),
    next_section
)

if wrapper_close < 0:
    raise RuntimeError(
        "원장별 wrapper 종료를 못 찾았습니다."
    )

block_end = wrapper_close + len("</div>")

block = s[div_start:block_end]

# ============================================================
# 이미 적용됐는지 검사
# ============================================================

before = s[max(article_start, div_start - 800):div_start]

if "원장 상세보기" in before:
    print("SKIP: 원장별 상세보기 이미 적용됨")

else:

    # 기존 margin만 축소
    block = block.replace(
        'className="mt-6 overflow-x-auto"',
        'className="mt-3 overflow-x-auto"',
        1
    ).replace(
        'className="mt-4 overflow-x-auto"',
        'className="mt-3 overflow-x-auto"',
        1
    )

    replacement = '''                      <details className="group mt-5">
                        <summary className="flex cursor-pointer list-none items-center justify-end rounded-lg px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50">
                          <span className="group-open:hidden">
                            원장 상세보기 ▼
                          </span>
                          <span className="hidden group-open:inline">
                            접기 ▲
                          </span>
                        </summary>

''' + block + '''

                      </details>'''

    s = (
        s[:div_start]
        + replacement
        + s[block_end:]
    )

    print("OK: 원장별 상세보기 적용")


p.write_text(s, encoding="utf-8")

print("")
print("========================================")
print(" DOCTOR DETAIL PATCH COMPLETE")
print("========================================")
print("✓ 원장 요약 데이터 유지")
print("✓ 원장별 표 기본 접힘")
print("✓ 원장 상세보기 ▼")
print("✓ 접기 ▲")
print("backup:", bak.name)
