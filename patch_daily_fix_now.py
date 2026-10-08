from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_dailyfix_{stamp}")
shutil.copy2(p, bak)

print("BACKUP:", bak)

# =========================================================
# 1) 선택 월 rows 필터
# selectedMonth가 0-based/1-based인지 기존 코드에 따라
# dashboardData 자체가 선택 월 데이터면 추가 필터 불필요.
# 여기서는 date에서 현재 화면 month와 맞는 행만 사용하도록
# selectedMonthKey를 dashboardData.month가 있으면 우선 사용.
# =========================================================

old_rows = re.compile(
    r'''const\s+rows\s*=\s*
\s*dashboardData\.dailyConversions\s*\?\?\s*\[\];'''
)

matches = list(old_rows.finditer(s))

if matches:
    m = matches[-1]

    replacement = '''const allDailyConversionRows =
                    dashboardData.dailyConversions ?? [];

                  const selectedMonthKey =
                    `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

                  const rows =
                    allDailyConversionRows.filter((row) =>
                      row.date.startsWith(selectedMonthKey)
                    );'''

    s = s[:m.start()] + replacement + s[m.end():]

    print("OK: dailyConversions 선택월 필터 적용")

elif "allDailyConversionRows" in s:
    print("SKIP: 선택월 필터 이미 적용")

else:
    print("WARN: rows 선언은 이미 다른 형태임")


# =========================================================
# 2) 일별 테이블 정확히 찾아서 details로 감싸기
# =========================================================

table_token = '<table className="w-full min-w-[560px] border-collapse">'

table_pos = s.find(table_token)

if table_pos == -1:
    raise RuntimeError("일별 table을 찾지 못함")

# table 바로 앞의 div
div_pos = s.rfind("<div", 0, table_pos)

if div_pos == -1:
    raise RuntimeError("일별 table 부모 div를 찾지 못함")

# 이 테이블 뒤 empty 메시지
empty_text = "일별 상담/수술전환 데이터가 없습니다."
empty_pos = s.find(empty_text, table_pos)

if empty_pos == -1:
    raise RuntimeError("일별 empty 메시지를 찾지 못함")

# empty 메시지 이후:
# </div> = empty div
# )} 
# </div> = 테이블 wrapper
#
# 그래서 empty 이후 두 번째 </div>까지 잡는다.

first_close = s.find("</div>", empty_pos)

if first_close == -1:
    raise RuntimeError("첫 번째 닫는 div 못 찾음")

second_close = s.find("</div>", first_close + 6)

if second_close == -1:
    raise RuntimeError("두 번째 닫는 div 못 찾음")

block_end = second_close + len("</div>")

block = s[div_pos:block_end]

# 이미 details 내부인지 검사
before = s[max(0, div_pos - 500):div_pos]

if "<details" in before and "</details>" not in before:
    print("SKIP: 일별 표 이미 details 안에 있음")

else:
    # 기존 wrapper margin 축소
    block = re.sub(
        r'className="mt-\d+\s+overflow-x-auto"',
        'className="mt-3 overflow-x-auto"',
        block,
        count=1
    )

    wrapped = '''<details className="group mt-5">
                        <summary className="flex cursor-pointer list-none items-center justify-end gap-2 rounded-xl px-3 py-2 text-sm font-black text-blue-600 hover:bg-blue-50">
                          <span className="group-open:hidden">
                            상세보기 ▼
                          </span>
                          <span className="hidden group-open:inline">
                            접기 ▲
                          </span>
                        </summary>

                        ''' + block + '''

                      </details>'''

    s = s[:div_pos] + wrapped + s[block_end:]

    print("OK: 일별 상세표 기본 접힘 적용")


p.write_text(s, encoding="utf-8")

print("")
print("====================================")
print(" DAILY FIX PATCH COMPLETE")
print("====================================")
print("✓ 선택 월 rows 필터")
print("✓ 일별 상세 기본 접힘")
print("✓ 상세보기 ▼ 버튼")
print("====================================")
