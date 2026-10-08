from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_dashboard_conversion_cards_{stamp}")
shutil.copy2(p, bak)

# ============================================================
# 1. dailyConversions 타입에 actualSurgeries 보장
# ============================================================

pattern = re.compile(
    r'''dailyConversions:\s*\{\s*
        date:\s*string;\s*
        (?:
          actualSurgeries:\s*number;\s*
        )?
        consultations:\s*number;\s*
        surgeries:\s*number;\s*
        rate:\s*number;\s*
        \}\[\];''',
    re.VERBOSE
)

replacement = '''dailyConversions: {
    date: string;
    actualSurgeries: number;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];'''

s, count = pattern.subn(
    replacement,
    s,
    count=1
)

if count != 1:
    print("TYPE: 기존에 이미 반영됐거나 형태가 다름")


# ============================================================
# 2. 상담 대비 수술 전환 섹션의 합계 계산 교체
#
# 핵심:
# - 상담 = current.consultations (월 저장값)
# - 수술전환 = current.surgeries (월 저장값)
# - 수술 수 = daily actualSurgeries 합
#
# 상담/수술전환을 rows.reduce로 다시 계산하지 않는다.
# ============================================================

section_start = s.find("상담 대비 수술 전환")

if section_start < 0:
    raise RuntimeError(
        "상담 대비 수술 전환 섹션을 찾지 못했습니다."
    )

# 해당 섹션 이후에서 다음 큰 섹션 전까지만 작업
section_end = s.find(
    "원장별 수술 전환율",
    section_start
)

if section_end < 0:
    section_end = min(
        len(s),
        section_start + 15000
    )

section = s[
    section_start:
    section_end
]

# 기존 totalConsultations ~ conversionRate 계산부 검색
pattern_totals = re.compile(
    r'''const\s+totalConsultations\s*=
        [\s\S]*?
        const\s+conversionRate\s*=
        [\s\S]*?;''',
    re.VERBOSE
)

m = pattern_totals.search(section)

if not m:
    raise RuntimeError(
        "상담/수술 합계 계산 블록을 찾지 못했습니다."
    )

new_totals = '''const totalActualSurgeries =
                      rows.reduce(
                        (sum, row) =>
                          sum +
                          Number(
                            row.actualSurgeries ?? 0
                          ),
                        0
                      );

                    /*
                     * 월 KPI의 상담/수술전환은
                     * 일별 rows를 다시 합산하지 않는다.
                     *
                     * Excel 미리보기 → commit →
                     * monthly_conversion_stats에 저장된
                     * 월 확정값을 단일 기준으로 사용한다.
                     *
                     * 따라서 일별 데이터가 일부 비어도
                     * 월 KPI가 다시 틀어지지 않는다.
                     */
                    const totalConsultations =
                      current.consultations;

                    const totalSurgeries =
                      current.surgeries;

                    const conversionRate =
                      totalConsultations > 0
                        ? (
                            totalSurgeries /
                            totalConsultations
                          ) * 100
                        : 0;'''

section = (
    section[:m.start()]
    + new_totals
    + section[m.end():]
)

s = (
    s[:section_start]
    + section
    + s[section_end:]
)


# ============================================================
# 3. 현재 3개 KPI 카드 블록에 "수술 수" 카드 추가
#
# "상담" 카드 바로 앞에 추가
# ============================================================

section_start = s.find("상담 대비 수술 전환")
section_end = s.find(
    "원장별 수술 전환율",
    section_start
)

if section_end < 0:
    section_end = min(
        len(s),
        section_start + 15000
    )

section = s[
    section_start:
    section_end
]

# 상담 카드의 label을 기준으로 카드 컨테이너 시작 탐색
consult_label = re.search(
    r'>\s*상담\s*<',
    section
)

if not consult_label:
    raise RuntimeError(
        "상담 KPI 카드 label을 못 찾았습니다."
    )

# 상담 label 이전 가장 가까운 카드 div 찾기
card_start = section.rfind(
    '<div',
    0,
    consult_label.start()
)

if card_start < 0:
    raise RuntimeError(
        "상담 KPI 카드 시작점을 못 찾았습니다."
    )

# 카드 div 전체를 간단한 brace가 아니라
# JSX div depth로 찾기
def find_div_end(text, start):
    token_re = re.compile(r'<div\b|</div>')
    depth = 0

    for mm in token_re.finditer(text, start):
        token = mm.group(0)

        if token.startswith("<div"):
            depth += 1
        else:
            depth -= 1

            if depth == 0:
                return mm.end()

    return -1

card_end = find_div_end(
    section,
    card_start
)

if card_end < 0:
    raise RuntimeError(
        "상담 KPI 카드 종료점을 못 찾았습니다."
    )

consult_card = section[
    card_start:
    card_end
]

# 상담 카드 스타일을 그대로 복제해 "수술 수" 카드 생성
surgery_card = consult_card

surgery_card = re.sub(
    r'>\s*상담\s*<',
    '>수술 수<',
    surgery_card,
    count=1
)

# 상담 값 expression을 totalActualSurgeries로 교체
# current/totalConsultations 등 다양한 형태 대응
surgery_card = re.sub(
    r'\{(?:formatInteger\(\s*)?totalConsultations(?:\s*\))?\}',
    '{totalActualSurgeries.toLocaleString()}',
    surgery_card,
    count=1
)

surgery_card = re.sub(
    r'\{(?:formatInteger\(\s*)?current\.consultations(?:\s*\))?\}',
    '{totalActualSurgeries.toLocaleString()}',
    surgery_card,
    count=1
)

# 혹시 위 패턴이 못 잡혔으면 첫 큰 숫자 expression 탐색
if "totalActualSurgeries" not in surgery_card:
    surgery_card = re.sub(
        r'\{[^{}]*(?:consultations|totalConsultations)[^{}]*\}',
        '{totalActualSurgeries.toLocaleString()}',
        surgery_card,
        count=1
    )

if "totalActualSurgeries" not in surgery_card:
    raise RuntimeError(
        "수술 수 카드 값 expression 생성 실패"
    )

# 이미 수술 수 카드가 없다면 삽입
if not re.search(
    r'>\s*수술 수\s*<',
    section
):
    section = (
        section[:card_start]
        + surgery_card
        + "\n"
        + section[card_start:]
    )

s = (
    s[:section_start]
    + section
    + s[section_end:]
)


# ============================================================
# 4. 상세 테이블 헤더
# 일자 | 수술 수 | 상담 | 수술 전환 | 전환율
# ============================================================

section_start = s.find("상담 대비 수술 전환")
section_end = s.find(
    "원장별 수술 전환율",
    section_start
)

if section_end < 0:
    section_end = min(
        len(s),
        section_start + 18000
    )

section = s[
    section_start:
    section_end
]

# 아직 row.actualSurgeries가 상세에 없다면
if "row.actualSurgeries.toLocaleString()" not in section:

    # 상담 데이터 셀 앞에 수술 수 셀 삽입
    pattern_consult_cell = re.compile(
        r'''(<td[^>]*>\s*
             \{row\.consultations\.toLocaleString\(\)\}
             \s*</td>)''',
        re.VERBOSE
    )

    m = pattern_consult_cell.search(section)

    if not m:
        raise RuntimeError(
            "상세 상담 셀을 못 찾았습니다."
        )

    consult_cell = m.group(1)

    actual_cell = re.sub(
        r'row\.consultations',
        'row.actualSurgeries',
        consult_cell
    )

    section = (
        section[:m.start()]
        + actual_cell
        + "\n"
        + consult_cell
        + section[m.end():]
    )

# 헤더에 수술 수가 없다면 상담 앞에 추가
if not re.search(
    r'<th[^>]*>\s*수술 수\s*</th>',
    section
):
    pattern_header = re.compile(
        r'(<th[^>]*>\s*상담\s*</th>)'
    )

    m = pattern_header.search(section)

    if not m:
        raise RuntimeError(
            "상세 상담 헤더를 못 찾았습니다."
        )

    consult_th = m.group(1)

    surgery_th = re.sub(
        r'>\s*상담\s*<',
        '>수술 수<',
        consult_th
    )

    section = (
        section[:m.start()]
        + surgery_th
        + "\n"
        + consult_th
        + section[m.end():]
    )

s = (
    s[:section_start]
    + section
    + s[section_end:]
)

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("===========================================")
print(" DASHBOARD CONVERSION SECTION FIXED")
print("===========================================")
print("카드:")
print("수술 수 / 상담 / 수술 전환 / 전환율")
print("")
print("상담/수술전환 = 월 확정 DB 값")
print("수술 수       = 일별 actualSurgeries 합")
print("")
print("8월 기대:")
print("수술 수 118")
print("상담 329")
print("수술 전환 42")
print("전환율 12.77%")
print("===========================================")
print("backup:", bak.name)
