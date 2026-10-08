from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_daily_exact_real_{stamp}")
shutil.copy2(p, bak)

print("BACKUP:", bak)

# ----------------------------------------------------------
# 상담 대비 수술 전환 섹션만 대상으로 한다.
# ----------------------------------------------------------

section = s.find("상담 대비 수술 전환")

if section < 0:
    raise RuntimeError("상담 대비 수술 전환 섹션을 못 찾음")


# ==========================================================
# 1. 선택한 월 데이터만 사용
# ==========================================================

old_rows = '''                  const rows =
                    dashboardData.dailyConversions ?? [];'''

new_rows = '''                  const rows =
                    (dashboardData.dailyConversions ?? []).filter(
                      (row) =>
                        String(row.date).slice(0, 7) ===
                        String(dashboardData.selectedMonth).slice(0, 7)
                    );'''

pos = s.find(old_rows, section)

if pos < 0:
    raise RuntimeError(
        "2060~2061의 dailyConversions rows 선언을 못 찾음"
    )

s = (
    s[:pos]
    + new_rows
    + s[pos + len(old_rows):]
)

print("OK 1/3: 선택 월 필터 적용")


# ==========================================================
# 2. 실제 2128행 테이블 시작을 정확히 교체
# ==========================================================

old_open = '''                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse">'''

new_open = '''                      <details className="group mt-5">
                        <summary className="flex cursor-pointer list-none items-center justify-end rounded-lg px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50">
                          <span className="group-open:hidden">
                            상세보기 ▼
                          </span>
                          <span className="hidden group-open:inline">
                            접기 ▲
                          </span>
                        </summary>

                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[560px] border-collapse">'''

pos = s.find(old_open, section)

if pos < 0:
    raise RuntimeError(
        "2128 일별 테이블 시작 코드를 못 찾음"
    )

s = (
    s[:pos]
    + new_open
    + s[pos + len(old_open):]
)

print("OK 2/3: 상세보기 시작 추가")


# ==========================================================
# 3. 실제 일별 테이블 끝에 </details> 정확히 추가
# ==========================================================

old_close = '''                        {rows.length === 0 && (
                          <div className="py-10 text-center text-sm text-zinc-400">
                            일별 상담/수술전환 데이터가 없습니다.
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}'''

new_close = '''                        {rows.length === 0 && (
                          <div className="py-10 text-center text-sm text-zinc-400">
                            일별 상담/수술전환 데이터가 없습니다.
                          </div>
                        )}
                        </div>
                      </details>
                    </>
                  );
                })()}'''

pos = s.find(old_close, section)

if pos < 0:
    raise RuntimeError(
        "2174 이후 일별 테이블 종료 코드를 못 찾음"
    )

s = (
    s[:pos]
    + new_close
    + s[pos + len(old_close):]
)

print("OK 3/3: 상세보기 종료 추가")

p.write_text(s, encoding="utf-8")

print("")
print("========================================")
print(" DAILY EXACT REAL PATCH COMPLETE")
print("========================================")
print("선택 월:", "dashboardData.selectedMonth")
print("기본 상태: 접힘")
print("상세보기 클릭: 날짜별 표 표시")
print("backup:", bak)
