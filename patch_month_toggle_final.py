from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = Path(str(p) + f".bak_month_toggle_{stamp}")
shutil.copy2(p, backup)

print("BACKUP:", backup)

# ==========================================================
# 1. 일별 데이터: 선택 월만 강제 필터
# ==========================================================

old = '''                  const rows =
                    dashboardData.dailyConversions ?? [];'''

new = '''                  const selectedMonthPrefix =
                    `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

                  const rows =
                    (dashboardData.dailyConversions ?? []).filter(
                      (row) =>
                        row.date.startsWith(selectedMonthPrefix)
                    );'''

if old in s:
    s = s.replace(old, new, 1)
    print("OK: 일별 선택월 필터")
elif "selectedMonthPrefix" in s:
    print("SKIP: 일별 선택월 필터 이미 있음")
else:
    raise RuntimeError("일별 rows 선언을 못 찾음")


# ==========================================================
# 2. 일별 표를 details로 정확히 교체
# ==========================================================

daily_start_marker = '''                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse">'''

daily_end_marker = '''                        )}
                      </div>'''

start = s.find(daily_start_marker)

if start < 0:
    # 이전 실패 패치가 class mt-4로 바꿨을 가능성 대응
    daily_start_marker = '''                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse">'''
    start = s.find(daily_start_marker)

if start < 0:
    # 이미 details가 있으면 중복 적용 방지
    if '일별 상세보기' in s:
        print("SKIP: 일별 접기 이미 적용")
    else:
        raise RuntimeError("일별 표 시작 못 찾음")
else:
    empty_pos = s.find(
        "일별 상담/수술전환 데이터가 없습니다.",
        start
    )

    if empty_pos < 0:
        raise RuntimeError("일별 empty 문구 못 찾음")

    end = s.find(daily_end_marker, empty_pos)

    if end < 0:
        raise RuntimeError("일별 표 끝 못 찾음")

    end += len(daily_end_marker)

    original = s[start:end]

    # 기존 mt-6만 mt-3으로 변경
    original = original.replace(
        'className="mt-6 overflow-x-auto"',
        'className="mt-3 overflow-x-auto"',
        1
    ).replace(
        'className="mt-4 overflow-x-auto"',
        'className="mt-3 overflow-x-auto"',
        1
    )

    wrapped = '''                      <details className="group mt-5">
                        <summary className="flex cursor-pointer list-none justify-end text-sm font-bold text-blue-600 hover:text-blue-700">
                          <span className="group-open:hidden">
                            상세보기 ▼
                          </span>
                          <span className="hidden group-open:inline">
                            접기 ▲
                          </span>
                        </summary>

''' + original + '''
                      </details>'''

    s = s[:start] + wrapped + s[end:]

    print("OK: 일별 상세 기본 접힘")


# ==========================================================
# 3. 원장별 데이터도 선택월 필터
#
# doctorConversions에 date가 있는 경우만 필터.
# 현재 타입이 date 없이 월 단위로 반환된다면 서버에서 이미
# 선택 월 자료이므로 그대로 사용.
# ==========================================================

old = '''                  const rows =
                    dashboardData.doctorConversions ?? [];'''

new = '''                  const rows =
                    dashboardData.doctorConversions ?? [];'''

# 여기서는 date 필드 타입을 억지로 추가하지 않는다.
# doctorConversions는 현재 선택 월 쿼리 결과를 사용.
if old not in s:
    print("INFO: 원장 rows 선언 형태가 이미 변경됨")
else:
    print("OK: 원장 데이터는 서버 선택월 결과 사용")


# ==========================================================
# 4. 원장별 표를 details로 정확히 교체
# ==========================================================

doctor_start_marker = '''                      <div className="mt-6 overflow-x-auto">

                        <table className="w-full min-w-[760px] text-sm">'''

start = s.find(doctor_start_marker)

if start < 0:
    # 공백 차이 대응
    doctor_start_marker = '''                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">'''
    start = s.find(doctor_start_marker)

if start < 0:
    doctor_start_marker = '''                      <div className="mt-4 overflow-x-auto">

                        <table className="w-full min-w-[760px] text-sm">'''
    start = s.find(doctor_start_marker)

if start < 0:
    if '원장별 상세보기' in s:
        print("SKIP: 원장 접기 이미 적용")
    else:
        raise RuntimeError("원장별 표 시작 못 찾음")
else:
    empty_pos = s.find(
        "원장별 상담/수술 데이터가 없습니다.",
        start
    )

    if empty_pos < 0:
        raise RuntimeError("원장 empty 문구 못 찾음")

    doctor_end_marker = '''                        )}

                      </div>'''

    end = s.find(doctor_end_marker, empty_pos)

    if end < 0:
        # 빈 줄 없는 경우
        doctor_end_marker = '''                        )}
                      </div>'''

        end = s.find(doctor_end_marker, empty_pos)

    if end < 0:
        raise RuntimeError("원장 표 끝 못 찾음")

    end += len(doctor_end_marker)

    original = s[start:end]

    original = original.replace(
        'className="mt-6 overflow-x-auto"',
        'className="mt-3 overflow-x-auto"',
        1
    ).replace(
        'className="mt-4 overflow-x-auto"',
        'className="mt-3 overflow-x-auto"',
        1
    )

    wrapped = '''                      <details className="group mt-5">
                        <summary className="flex cursor-pointer list-none justify-end text-sm font-bold text-blue-600 hover:text-blue-700">
                          <span className="group-open:hidden">
                            상세보기 ▼
                          </span>
                          <span className="hidden group-open:inline">
                            접기 ▲
                          </span>
                        </summary>

''' + original + '''
                      </details>'''

    s = s[:start] + wrapped + s[end:]

    print("OK: 원장별 상세 기본 접힘")


p.write_text(s, encoding="utf-8")

print("")
print("========================================")
print(" MONTH + COLLAPSE PATCH COMPLETE")
print("========================================")
print("✓ 일별: 선택 월만")
print("✓ 일별 상세: 기본 접힘")
print("✓ 원장 상세: 기본 접힘")
print("✓ 요약 카드는 항상 표시")
print("backup:", backup.name)
