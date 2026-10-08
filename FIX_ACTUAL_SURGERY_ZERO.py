from pathlib import Path
from datetime import datetime
import shutil
import re

PREVIEW = Path("app/api/admin/import/preview/route.ts")
COMMIT  = Path("app/api/admin/import/commit/route.ts")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

for p in [PREVIEW, COMMIT]:
    shutil.copy2(
        p,
        Path(str(p) + f".bak_actual_surgery_parser_{stamp}")
    )

# ==========================================================
# PREVIEW
# ==========================================================

p = PREVIEW
s = p.read_text(encoding="utf-8-sig")

start = s.find("function parseDailyConversionLayout(")
end = s.find("function parseMonthlyConversionLayout(", start)

if start < 0 or end < 0:
    raise RuntimeError("parseDailyConversionLayout 함수 범위 못 찾음")

before = s[:start]
fn = s[start:end]
after = s[end:]

# ----------------------------------------------------------
# 1. DailyConversionRow 타입 actualSurgeries 보장
# ----------------------------------------------------------

type_old = '''type DailyConversionRow = {
  date: string;
  consultations: number;
  surgeries: number;
};'''

type_new = '''type DailyConversionRow = {
  date: string;
  actualSurgeries: number;
  consultations: number;
  surgeries: number;
};'''

if type_old in before:
    before = before.replace(
        type_old,
        type_new,
        1
    )

# ----------------------------------------------------------
# 2. actualSurgeryCol 선언
# ----------------------------------------------------------

if "let actualSurgeryCol" not in fn:
    fn = fn.replace(
        '''  let dateCol = -1;
  let consultationCol = -1;''',
        '''  let dateCol = -1;
  let actualSurgeryCol = -1;
  let consultationCol = -1;''',
        1
    )

# ----------------------------------------------------------
# 3. 헤더에서 "수술 수" 직접 찾기
# compactText("수술 수") => "수술수"
# ----------------------------------------------------------

if 'text === "수술수"' not in fn:

    marker = '''    if (
      text === "상담" ||
      text === "상담수" ||
      text === "상담건수"
    ) {
      consultationCol = c;
    }'''

    block = '''    if (
      text === "수술수" ||
      text === "수술건수" ||
      text === "실제수술" ||
      text === "실수술"
    ) {
      actualSurgeryCol = c;
    }

'''

    if marker not in fn:
        raise RuntimeError("상담 헤더 탐색 위치 못 찾음")

    fn = fn.replace(
        marker,
        block + marker,
        1
    )

# ----------------------------------------------------------
# 4. 헤더 탐색 이후 fallback
#
# MIHO 표 구조:
# 일자 바로 다음 열이 "수술 수"
#
# 헤더 문자열이 병합셀 등의 이유로 안 잡혀도
# dateCol + 1을 사용.
# ----------------------------------------------------------

fallback_marker = '''  if (
    dateCol < 0'''

if fallback_marker not in fn:
    raise RuntimeError("헤더 검증 위치 못 찾음")

if "actualSurgeryCol < 0 && dateCol >= 0" not in fn:

    fallback = '''  if (
    actualSurgeryCol < 0 &&
    dateCol >= 0
  ) {
    actualSurgeryCol =
      dateCol + 1;
  }

'''

    fn = fn.replace(
        fallback_marker,
        fallback + fallback_marker,
        1
    )

# 헤더 검증에도 actual 추가
fn = fn.replace(
    '''    dateCol < 0 ||
    consultationCol < 0 ||''',
    '''    dateCol < 0 ||
    actualSurgeryCol < 0 ||
    consultationCol < 0 ||''',
    1
)

# ----------------------------------------------------------
# 5. 각 날짜의 실제 수술 수 읽기
# ----------------------------------------------------------

if "const actualSurgeries =" not in fn:

    marker = '''    const consultations =
      intValue(
        row[
          consultationCol
        ]
      ) ?? 0;'''

    actual = '''    const actualSurgeries =
      intValue(
        row[
          actualSurgeryCol
        ]
      ) ?? 0;

'''

    if marker not in fn:
        raise RuntimeError("consultations 값 읽는 위치 못 찾음")

    fn = fn.replace(
        marker,
        actual + marker,
        1
    )

# ----------------------------------------------------------
# 6. result.push에 actualSurgeries 넣기
# ----------------------------------------------------------

push_old = '''    result.push({
      date,
      consultations,
      surgeries,
    });'''

push_new = '''    result.push({
      date,
      actualSurgeries,
      consultations,
      surgeries,
    });'''

if push_old in fn:
    fn = fn.replace(
        push_old,
        push_new,
        1
    )
elif "actualSurgeries," not in fn[fn.find("result.push"):]:
    raise RuntimeError("result.push actualSurgeries 추가 실패")

s = before + fn + after

# ----------------------------------------------------------
# 7. 최종 미리보기 월 수술 수 합계
# ----------------------------------------------------------

if "const actualSurgeriesTotal =" not in s:

    marker = '''        const totalApplications ='''

    pos = s.rfind(marker)

    if pos < 0:
        raise RuntimeError("preview 월 합계 위치 못 찾음")

    block = '''        const actualSurgeriesTotal =
          dailyConversions.reduce(
            (sum, row) =>
              sum +
              Number(
                row.actualSurgeries ?? 0
              ),
            0
          );

'''

    s = (
        s[:pos]
        + block
        + s[pos:]
    )

# preview return
if "actualSurgeries: actualSurgeriesTotal" not in s:

    marker = '''          dailyConversions,
'''

    pos = s.rfind(marker)

    if pos < 0:
        raise RuntimeError("preview return dailyConversions 못 찾음")

    replacement = '''          dailyConversions,
          actualSurgeries: actualSurgeriesTotal,
'''

    s = (
        s[:pos]
        + s[pos:].replace(
            marker,
            replacement,
            1
        )
    )

p.write_text(s, encoding="utf-8")

print("OK 1/2 PREVIEW actualSurgeries 연결")


# ==========================================================
# COMMIT
# ==========================================================

p = COMMIT
s = p.read_text(encoding="utf-8-sig")

# 타입 보장
if "actualSurgeries: number;" not in s:

    s = s.replace(
        '''  dailyConversions?: {
    date: string;
    consultations: number;
    surgeries: number;
  }[];''',
        '''  dailyConversions?: {
    date: string;
    actualSurgeries: number;
    consultations: number;
    surgeries: number;
  }[];''',
        1
    )

# 저장 values
if "safeNumber(row.actualSurgeries)" not in s:

    marker = '''              date: row.date,
              consultations:
                safeNumber(row.consultations),'''

    replacement = '''              date: row.date,
              actualSurgeries:
                safeNumber(
                  row.actualSurgeries
                ),
              consultations:
                safeNumber(row.consultations),'''

    if marker not in s:
        raise RuntimeError("commit dailyConversion values 위치 못 찾음")

    s = s.replace(
        marker,
        replacement,
        1
    )

# upsert actual_surgeries
if "excluded.actual_surgeries" not in s:

    marker = '''            set: {
              consultations:
                sql`excluded.consultations`,'''

    replacement = '''            set: {
              actualSurgeries:
                sql`excluded.actual_surgeries`,
              consultations:
                sql`excluded.consultations`,'''

    if marker not in s:
        raise RuntimeError("commit upsert set 위치 못 찾음")

    s = s.replace(
        marker,
        replacement,
        1
    )

p.write_text(s, encoding="utf-8")

print("OK 2/2 COMMIT actualSurgeries 연결")

print("")
print("========================================")
print(" ACTUAL SURGERY PIPELINE FIXED")
print("========================================")
print("엑셀:")
print("일자 | 수술 수 | 상담 | 수술 전환 | 전환율")
print("")
print("미리보기:")
print("수술 수 / 상담 수 / 수술 결정 / 수술 전환율")
print("")
print("8월 목표:")
print("118 / 329 / 42 / 12.77%")
print("========================================")

