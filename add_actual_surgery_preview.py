from pathlib import Path
from datetime import datetime
import shutil
import re

PREVIEW = Path("app/api/admin/import/preview/route.ts")
UI = Path("components/ExcelImportManager.tsx")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

for p in [PREVIEW, UI]:
    shutil.copy2(
        p,
        Path(str(p) + f".bak_actual_surgery_{stamp}")
    )

# =========================================================
# 1. PREVIEW API
# =========================================================

s = PREVIEW.read_text(encoding="utf-8-sig")

# DailyConversionRow에 actualSurgeries 추가
old = '''type DailyConversionRow = {
  date: string;
  consultations: number;
  surgeries: number;
};'''

new = '''type DailyConversionRow = {
  date: string;

  // 실제 해당 일자에 진행된 수술 수
  actualSurgeries: number;

  // 상담 건수
  consultations: number;

  // 상담 후 수술 결정/전환 건수
  surgeries: number;
};'''

if old in s:
    s = s.replace(old, new, 1)


# ---------------------------------------------------------
# parseDailyConversionLayout에 실제 수술 수 column 추가
# 현재 엑셀 구조:
# 일자 | 수술 수 | 상담 | 수술 전환 | 전환율
# ---------------------------------------------------------

# 변수 선언 추가
s = s.replace(
'''  let dateCol = -1;
  let consultationCol = -1;
  let conversionCol = -1;''',
'''  let dateCol = -1;
  let actualSurgeryCol = -1;
  let consultationCol = -1;
  let conversionCol = -1;''',
1
)

# 헤더 탐색에 수술 수 추가
needle = '''    if (
      text === "상담" ||
      text === "상담수" ||
      text === "상담건수"
    ) {
      consultationCol = c;
    }'''

replacement = '''    if (
      text === "수술수" ||
      text === "수술건수" ||
      text === "실제수술" ||
      text === "실수술"
    ) {
      actualSurgeryCol = c;
    }

    if (
      text === "상담" ||
      text === "상담수" ||
      text === "상담건수"
    ) {
      consultationCol = c;
    }'''

if needle in s:
    s = s.replace(needle, replacement, 1)


# 헤더 검증 조건에 actualSurgeryCol 추가
s = s.replace(
'''    dateCol < 0 ||
    consultationCol < 0 ||
    conversionCol < 0''',
'''    dateCol < 0 ||
    actualSurgeryCol < 0 ||
    consultationCol < 0 ||
    conversionCol < 0''',
1
)


# result.push 전에 actualSurgeries 계산
needle = '''    const consultations =
      intValue(
        row[
          consultationCol
        ]
      ) ?? 0;

    const surgeries =
      intValue(
        row[
          conversionCol
        ]
      ) ?? 0;

    result.push({
      date,
      consultations,
      surgeries,
    });'''

replacement = '''    const actualSurgeries =
      intValue(
        row[
          actualSurgeryCol
        ]
      ) ?? 0;

    const consultations =
      intValue(
        row[
          consultationCol
        ]
      ) ?? 0;

    const surgeries =
      intValue(
        row[
          conversionCol
        ]
      ) ?? 0;

    result.push({
      date,
      actualSurgeries,
      consultations,
      surgeries,
    });'''

if needle not in s:
    raise RuntimeError(
        "일별 상담/수술 result.push 블록을 못 찾았습니다."
    )

s = s.replace(needle, replacement, 1)


# ---------------------------------------------------------
# preview 최종 결과에 실제 수술 합계 추가
# ---------------------------------------------------------

needle = '''        const totalApplications ='''

pos = s.rfind(needle)

if pos < 0:
    raise RuntimeError("preview 합계 위치 못 찾음")

insert = '''        const actualSurgeries =
          dailyConversions.reduce(
            (sum, row) =>
              sum +
              (row.actualSurgeries ?? 0),
            0
          );

'''

s = s[:pos] + insert + s[pos:]


# return에 actualSurgeries 추가
needle = '''          dailyConversions,
          consultations: item.consultations,'''

if needle not in s:
    raise RuntimeError("preview return 위치 못 찾음")

s = s.replace(
    needle,
'''          dailyConversions,
          actualSurgeries,
          consultations: item.consultations,''',
    1
)

PREVIEW.write_text(s, encoding="utf-8")

print("PREVIEW API OK")


# =========================================================
# 2. ExcelImportManager UI
# =========================================================

s = UI.read_text(encoding="utf-8-sig")

# preview 타입에 actualSurgeries 추가
# consultations 필드 바로 앞에 넣음
if "actualSurgeries" not in s:
    s = re.sub(
        r'(\s+consultations:\s*number\s*\|\s*null;)',
        r'\n  actualSurgeries: number;\1',
        s,
        count=1
    )


# ---------------------------------------------------------
# 헤더:
# 상담 | 수술
# =>
# 수술 수 | 상담 | 수술 전환
# ---------------------------------------------------------

# 가장 흔한 JSX 헤더 문자열 패턴 대응
s = s.replace(
    '''<th className="px-3 py-3 text-right">상담</th>
                <th className="px-3 py-3 text-right">수술</th>''',
    '''<th className="px-3 py-3 text-right">수술 수</th>
                <th className="px-3 py-3 text-right">상담</th>
                <th className="px-3 py-3 text-right">수술 전환</th>'''
)

# className이 다른 경우 단순 텍스트 기준 처리
s = re.sub(
    r'(<th[^>]*>\s*)상담(\s*</th>\s*<th[^>]*>\s*)수술(\s*</th>)',
    r'\1수술 수\2상담\3\n                <th className="px-3 py-3 text-right">수술 전환</th>',
    s,
    count=1
)


# ---------------------------------------------------------
# 행 데이터:
# consultations / surgeries 앞에 actualSurgeries 삽입
# ---------------------------------------------------------

pattern = re.compile(
    r'''(
        <td[^>]*>\s*
        \{month\.consultations
        [\s\S]*?
        </td>
        \s*
        <td[^>]*>\s*
        \{month\.surgeries
        [\s\S]*?
        </td>
    )''',
    re.VERBOSE
)

m = pattern.search(s)

if m:
    old_block = m.group(1)

    # 첫 td의 className 재사용이 어려우므로 기존 스타일과 맞춘다.
    new_block = '''<td className="px-3 py-3 text-right">
                      {month.actualSurgeries?.toLocaleString?.() ?? month.actualSurgeries ?? 0}
                    </td>

                    ''' + old_block

    s = s[:m.start()] + new_block + s[m.end():]

else:
    # JSX가 단순 표현인 경우 fallback
    needle = '''{month.consultations'''

    idx = s.find(needle)

    if idx < 0:
        raise RuntimeError(
            "ExcelImportManager의 상담 셀 위치를 못 찾았습니다."
        )

    # 상담 td 시작점
    td_start = s.rfind("<td", 0, idx)

    if td_start < 0:
        raise RuntimeError("상담 td 시작점을 못 찾음")

    insert = '''<td className="px-3 py-3 text-right">
                    {month.actualSurgeries?.toLocaleString?.() ?? month.actualSurgeries ?? 0}
                  </td>
                  '''

    s = s[:td_start] + insert + s[td_start:]


UI.write_text(s, encoding="utf-8")

print("IMPORT UI OK")

print("")
print("======================================")
print(" ACTUAL SURGERY COLUMN ADDED")
print("======================================")
print("미리보기 순서:")
print("신청 / 예약 / 예약률 / 수술 수 / 상담 / 수술 전환 / 전환율")
print("")
print("※ DB 저장 구조는 건드리지 않음")
print("※ 상담/수술전환 데이터 유지")
print("======================================")
