from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = Path(str(p) + f".bak_details_{stamp}")
shutil.copy2(p, backup)

print("backup:", backup)

# ============================================================
# 1. 일별 상담 → 수술 전환 표 접기
# ============================================================

daily_empty = "일별 상담/수술전환 데이터가 없습니다."

daily_pos = s.find(daily_empty)

if daily_pos == -1:
    raise RuntimeError("일별 상세 영역을 못 찾았습니다.")

# empty 문구 기준으로 바로 앞의
# <div className="mt-6 overflow-x-auto"> 탐색
daily_table_start = s.rfind(
    '<div className="mt-6 overflow-x-auto">',
    0,
    daily_pos
)

if daily_table_start == -1:
    raise RuntimeError("일별 상세 테이블 시작점을 못 찾았습니다.")

# 해당 div의 닫는 </div>는 empty block 뒤 첫 번째
daily_table_end = s.find("</div>", daily_pos)

if daily_table_end == -1:
    raise RuntimeError("일별 상세 테이블 끝을 못 찾았습니다.")

daily_table_end += len("</div>")

daily_block = s[daily_table_start:daily_table_end]

if "<details" not in daily_block:

    daily_wrapped = '''<details className="mt-6 group">
                        <summary className="flex cursor-pointer list-none items-center justify-end gap-2 text-sm font-bold text-blue-600 hover:text-blue-700">
                          <span className="group-open:hidden">
                            상세보기 ▼
                          </span>
                          <span className="hidden group-open:inline">
                            접기 ▲
                          </span>
                        </summary>

                        ''' + daily_block.replace(
                            'className="mt-6 overflow-x-auto"',
                            'className="mt-4 overflow-x-auto"',
                            1
                        ) + '''

                      </details>'''

    s = (
        s[:daily_table_start]
        + daily_wrapped
        + s[daily_table_end:]
    )

    print("OK: 일별 상세 접기 적용")
else:
    print("SKIP: 일별 상세 이미 details 적용됨")


# ============================================================
# 2. 원장별 수술 전환율 표 접기
# ============================================================

doctor_empty = "원장별 상담/수술 데이터가 없습니다."

doctor_pos = s.find(doctor_empty)

if doctor_pos == -1:
    raise RuntimeError("원장별 상세 영역을 못 찾았습니다.")

doctor_table_start = s.rfind(
    '<div className="mt-6 overflow-x-auto">',
    0,
    doctor_pos
)

if doctor_table_start == -1:
    raise RuntimeError("원장별 상세 테이블 시작점을 못 찾았습니다.")

doctor_table_end = s.find("</div>", doctor_pos)

if doctor_table_end == -1:
    raise RuntimeError("원장별 상세 테이블 끝을 못 찾았습니다.")

doctor_table_end += len("</div>")

doctor_block = s[doctor_table_start:doctor_table_end]

if "<details" not in doctor_block:

    doctor_wrapped = '''<details className="mt-6 group">
                        <summary className="flex cursor-pointer list-none items-center justify-end gap-2 text-sm font-bold text-blue-600 hover:text-blue-700">
                          <span className="group-open:hidden">
                            상세보기 ▼
                          </span>
                          <span className="hidden group-open:inline">
                            접기 ▲
                          </span>
                        </summary>

                        ''' + doctor_block.replace(
                            'className="mt-6 overflow-x-auto"',
                            'className="mt-4 overflow-x-auto"',
                            1
                        ) + '''

                      </details>'''

    s = (
        s[:doctor_table_start]
        + doctor_wrapped
        + s[doctor_table_end:]
    )

    print("OK: 원장별 상세 접기 적용")
else:
    print("SKIP: 원장별 상세 이미 details 적용됨")


p.write_text(s, encoding="utf-8")

print("")
print("======================================")
print(" DETAIL COLLAPSE PATCH COMPLETE")
print("======================================")
