from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_consult_section_only_{stamp}")
shutil.copy2(p, bak)

# ============================================================
# 상담 대비 수술 전환 섹션만 범위 지정
# ============================================================

start = s.find("상담 대비 수술 전환")
end = s.find("원장별 수술 전환율", start)

if start < 0:
    raise RuntimeError("상담 대비 수술 전환 섹션 못 찾음")

if end < 0:
    raise RuntimeError("원장별 수술 전환율 시작점 못 찾음")

section = s[start:end]

# ============================================================
# 1. rows는 선택 월 데이터만 유지
# ============================================================

# 이미 있으면 그대로 둠
if "const rows =" not in section:
    raise RuntimeError("dailyConversions rows 선언 못 찾음")

# ============================================================
# 2. KPI 계산부를 확실하게 월 확정값 기준으로 만듦
# ============================================================

# totalActualSurgeries가 없으면 rows 선언 직후 넣기
if "const totalActualSurgeries =" not in section:

    rows_end = section.find(";", section.find("const rows ="))

    if rows_end < 0:
        raise RuntimeError("rows 선언 끝 못 찾음")

    rows_end += 1

    calc = '''

                  const totalActualSurgeries =
                    rows.reduce(
                      (sum, row) =>
                        sum + Number(row.actualSurgeries ?? 0),
                      0
                    );

                  /*
                   * 상담 / 수술전환은
                   * 엑셀에서 저장된 월 확정값 사용
                   */
                  const totalConsultations =
                    current.consultations;

                  const totalSurgeries =
                    current.surgeries;

                  const totalRate =
                    totalConsultations > 0
                      ? (totalSurgeries / totalConsultations) * 100
                      : 0;
'''

    section = section[:rows_end] + calc + section[rows_end:]

else:
    # 기존 값이 있다면 current 기준인지 강제로 보정
    section = re.sub(
        r'const\s+totalConsultations\s*=\s*[\s\S]*?;',
        '''const totalConsultations =
                    current.consultations;''',
        section,
        count=1
    )

    section = re.sub(
        r'const\s+totalSurgeries\s*=\s*[\s\S]*?;',
        '''const totalSurgeries =
                    current.surgeries;''',
        section,
        count=1
    )

    # totalRate도 보정
    if "const totalRate" in section:
        section = re.sub(
            r'const\s+totalRate\s*=\s*[\s\S]*?;',
            '''const totalRate =
                    totalConsultations > 0
                      ? (totalSurgeries / totalConsultations) * 100
                      : 0;''',
            section,
            count=1
        )

# ============================================================
# 3. KPI 영역 4칸
# ============================================================

section = section.replace(
    "md:grid-cols-3",
    "md:grid-cols-4",
    1
)

# ============================================================
# 4. 상담 카드 탐색
# ============================================================

consult_value_pos = section.find(
    "totalConsultations"
)

# 첫 번째는 계산부일 수 있으므로 JSX 쪽을 찾음
consult_value_pos = section.find(
    "totalConsultations",
    consult_value_pos + 1
)

if consult_value_pos < 0:
    # current.consultations 형태 fallback
    consult_value_pos = section.find(
        "current.consultations"
    )

if consult_value_pos < 0:
    raise RuntimeError("상담 카드 값 위치 못 찾음")


# JSX 카드 div 추출 함수
def find_card(text, value_pos):
    start = text.rfind("<div", 0, value_pos)

    if start < 0:
        return None

    token = re.compile(r"<div\b[^>]*>|</div>")
    depth = 0

    for m in token.finditer(text, start):
        if m.group(0).startswith("<div"):
            depth += 1
        else:
            depth -= 1

            if depth == 0:
                return start, m.end()

    return None


card_range = find_card(
    section,
    consult_value_pos
)

if not card_range:
    raise RuntimeError("상담 카드 범위 못 찾음")

consult_card_start, consult_card_end = card_range
consult_card = section[
    consult_card_start:
    consult_card_end
]

# ============================================================
# 5. 수술 수 카드가 없으면 상담 카드 복제
# ============================================================

if not re.search(
    r'>\s*수술 수\s*<',
    section
):
    actual_card = consult_card

    actual_card = re.sub(
        r'>\s*상담\s*<',
        '>수술 수<',
        actual_card,
        count=1
    )

    actual_card = actual_card.replace(
        "totalConsultations",
        "totalActualSurgeries"
    )

    actual_card = actual_card.replace(
        "current.consultations",
        "totalActualSurgeries"
    )

    section = (
        section[:consult_card_start]
        + actual_card
        + "\n"
        + section[consult_card_start:]
    )

# ============================================================
# 6. 카드 라벨 보장
# ============================================================

# 이 섹션 안에서 "수술" 단독 라벨이 있으면 수술 전환으로
section = re.sub(
    r'>\s*수술\s*<',
    '>수술 전환<',
    section
)

# 전환율 카드 라벨
section = re.sub(
    r'>\s*상담\s*→\s*수술\s*전환율\s*<',
    '>상담 → 수술 전환율<',
    section
)

# ============================================================
# 7. 상세 테이블도
# 일자 / 수술 수 / 상담 / 수술 전환 / 전환율
# ============================================================

if "row.actualSurgeries" not in section:

    target = "{row.consultations.toLocaleString()}"

    pos = section.find(target)

    if pos >= 0:
        td_start = section.rfind("<td", 0, pos)
        td_end = section.find("</td>", pos)

        if td_start >= 0 and td_end >= 0:
            td_end += len("</td>")

            consult_td = section[
                td_start:
                td_end
            ]

            actual_td = consult_td.replace(
                "row.consultations",
                "row.actualSurgeries"
            )

            section = (
                section[:td_start]
                + actual_td
                + "\n"
                + consult_td
                + section[td_end:]
            )

# 헤더
if not re.search(
    r'<th[^>]*>\s*수술 수\s*</th>',
    section
):
    m = re.search(
        r'<th[^>]*>\s*상담\s*</th>',
        section
    )

    if m:
        consult_th = m.group(0)

        actual_th = re.sub(
            r'>\s*상담\s*<',
            '>수술 수<',
            consult_th
        )

        section = (
            section[:m.start()]
            + actual_th
            + "\n"
            + consult_th
            + section[m.end():]
        )

# ============================================================
# 상담 섹션만 교체
# 원장별 섹션은 s[end:] 그대로 보존
# ============================================================

s = s[:start] + section + s[end:]

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("==========================================")
print(" CONSULTATION SECTION ONLY FIXED")
print("==========================================")
print("원장별 수술 전환율: 수정 안 함")
print("")
print("상담 대비 수술 전환:")
print("수술 수 / 상담 / 수술 전환 / 전환율")
print("")
print("8월 목표:")
print("118 / 329 / 42 / 12.77%")
print("==========================================")
print("backup:", bak.name)

