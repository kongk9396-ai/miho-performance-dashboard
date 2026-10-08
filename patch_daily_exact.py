from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_daily_details_exact_{stamp}")
shutil.copy2(p, bak)

# ============================================================
# 1. 선택한 월의 일별 데이터만 사용
# ============================================================

OLD_ROWS = '''                  const rows =
                    dashboardData.dailyConversions ?? [];'''

NEW_ROWS = '''                  const rows =
                    (dashboardData.dailyConversions ?? []).filter(
                      (row) =>
                        row.date.startsWith(
                          `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
                        )
                    );'''

# 상담 대비 수술 전환 영역(2043 이후)에 있는 rows만 교체
section_pos = s.find("상담 대비 수술 전환")

if section_pos < 0:
    raise RuntimeError("상담 대비 수술 전환 영역 못 찾음")

rows_pos = s.find(OLD_ROWS, section_pos)

if rows_pos >= 0:
    s = (
        s[:rows_pos]
        + NEW_ROWS
        + s[rows_pos + len(OLD_ROWS):]
    )
    print("OK 1: 선택 월 필터 적용")
elif "row.date.startsWith(" in s[section_pos:section_pos + 3000]:
    print("SKIP 1: 선택 월 필터 이미 적용")
else:
    raise RuntimeError("2060 rows 선언 못 찾음")


# ============================================================
# 2. 정확히 현재 일별 테이블만 <details>로 감싸기
# ============================================================

TABLE_START = '''                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse">'''

start = s.find(TABLE_START, section_pos)

if start < 0:
    raise RuntimeError("2128 일별 테이블 시작 못 찾음")

# 다음 section이 시작되기 전까지만 검색
next_section = s.find('<section', start + 1)

if next_section < 0:
    next_section = len(s)

region = s[start:next_section]

# 테이블 wrapper의 실제 끝:
# rows.length === 0 블록 뒤에 나오는 </div>
empty = "일별 상담/수술전환 데이터가 없습니다."

empty_rel = region.find(empty)

if empty_rel < 0:
    raise RuntimeError("일별 데이터 없음 문구 못 찾음")

# empty div 닫기
empty_div_close = region.find("</div>", empty_rel)

if empty_div_close < 0:
    raise RuntimeError("empty div 닫기 못 찾음")

# 그 다음이 wrapper div 닫기
wrapper_close = region.find("</div>", empty_div_close + len("</div>"))

if wrapper_close < 0:
    raise RuntimeError("테이블 wrapper 닫기 못 찾음")

end = start + wrapper_close + len("</div>")

block = s[start:end]

# 중복 방지
before = s[max(section_pos, start - 700):start]

if '<details className="group' in before:
    print("SKIP 2: 이미 details 적용됨")

else:
    block = block.replace(
        '<div className="mt-6 overflow-x-auto">',
        '<div className="mt-3 overflow-x-auto">',
        1
    )

    replacement = '''                      <details className="group mt-5">
                        <summary className="flex cursor-pointer list-none items-center justify-end rounded-xl px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50">
                          <span className="group-open:hidden">
                            상세보기 ▼
                          </span>
                          <span className="hidden group-open:inline">
                            접기 ▲
                          </span>
                        </summary>

''' + block + '''

                      </details>'''

    s = s[:start] + replacement + s[end:]

    print("OK 2: 상세보기 접기 적용")


p.write_text(s, encoding="utf-8")

print("")
print("========================================")
print(" EXACT DAILY PATCH COMPLETE")
print("========================================")
print("✓ 선택 월 데이터만 사용")
print("✓ 요약 카드는 항상 표시")
print("✓ 날짜별 표 기본 접힘")
print("✓ 상세보기 ▼ / 접기 ▲")
print("backup:", bak.name)
