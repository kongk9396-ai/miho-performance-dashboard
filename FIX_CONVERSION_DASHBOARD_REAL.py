from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_CONVERSION_UI_FINAL_{stamp}")
shutil.copy2(p, bak)

# ==========================================================
# 1. 기존 잘못된 KPI 계산 블록 교체
# ==========================================================

pattern = re.compile(
    r'''const\s+dailyConsultations\s*=
        rows\.reduce\([\s\S]*?
        const\s+totalRate\s*=
        totalConsultations\s*>\s*0
        [\s\S]*?
        :\s*0;''',
    re.VERBOSE
)

replacement = '''const totalActualSurgeries =
                    rows.reduce(
                      (sum, row) =>
                        sum +
                        Number(
                          row.actualSurgeries ?? 0
                        ),
                      0
                    );

                  /*
                   * KPI 기준:
                   *
                   * 수술 수 = 일별 actualSurgeries 합계
                   * 상담 = 월 확정값
                   * 수술 전환 = 월 확정값
                   *
                   * 상담/수술전환은 일별 rows로 다시 계산하지 않는다.
                   */
                  const totalConsultations =
                    dashboardData.current?.consultations ?? 0;

                  const totalSurgeries =
                    dashboardData.current?.surgeries ?? 0;

                  const totalRate =
                    totalConsultations > 0
                      ? (
                          totalSurgeries /
                          totalConsultations
                        ) * 100
                      : 0;'''

s, count = pattern.subn(
    replacement,
    s,
    count=1
)

if count != 1:
    raise RuntimeError(
        f"KPI 계산 블록 교체 실패: {count}"
    )

print("OK 1/4 KPI 계산 교체")


# ==========================================================
# 2. KPI 카드 영역 찾기
# ==========================================================

section_start = s.find("상담 대비 수술 전환")

if section_start < 0:
    raise RuntimeError("상담 대비 수술 전환 섹션 못 찾음")

section_end = s.find(
    "원장별 수술 전환율",
    section_start
)

if section_end < 0:
    raise RuntimeError("원장별 섹션 시작점 못 찾음")

section = s[section_start:section_end]


# ==========================================================
# 3. 카드 grid 3칸 → 4칸
# ==========================================================

section = section.replace(
    "grid-cols-1 gap-4 md:grid-cols-3",
    "grid-cols-1 gap-4 md:grid-cols-4",
    1
)

print("OK 2/4 카드 4칸")


# ==========================================================
# 4. 상담 카드 복제해서 앞에 수술 수 카드 추가
# ==========================================================

# 상담이라는 텍스트가 들어간 카드 탐색
label_match = re.search(
    r'>\s*상담\s*<',
    section
)

if not label_match:
    raise RuntimeError("상담 카드 label 못 찾음")

card_start = section.rfind(
    "<div",
    0,
    label_match.start()
)

if card_start < 0:
    raise RuntimeError("상담 카드 시작 못 찾음")

# div depth 추적
token = re.compile(r"<div\b[^>]*>|</div>")
depth = 0
card_end = -1

for m in token.finditer(section, card_start):
    if m.group(0).startswith("<div"):
        depth += 1
    else:
        depth -= 1

        if depth == 0:
            card_end = m.end()
            break

if card_end < 0:
    raise RuntimeError("상담 카드 끝 못 찾음")

consult_card = section[
    card_start:card_end
]

actual_card = consult_card

# 제목
actual_card = re.sub(
    r'>\s*상담\s*<',
    '>수술 수<',
    actual_card,
    count=1
)

# 값
actual_card = re.sub(
    r'\{[^{}]*(?:totalConsultations|current\.consultations)[^{}]*\}',
    '{totalActualSurgeries.toLocaleString()}',
    actual_card,
    count=1
)

if "totalActualSurgeries" not in actual_card:
    raise RuntimeError(
        "수술 수 카드 숫자 치환 실패"
    )

# 이미 없다면 삽입
if not re.search(
    r'>\s*수술 수\s*<',
    section
):
    section = (
        section[:card_start]
        + actual_card
        + "\n"
        + section[card_start:]
    )

print("OK 3/4 수술 수 카드 추가")


# ==========================================================
# 5. 상세 테이블도 수술 수 추가
# ==========================================================

if "row.actualSurgeries.toLocaleString()" not in section:

    consult_cell = re.search(
        r'''<td[^>]*>\s*
        \{row\.consultations\.toLocaleString\(\)\}
        \s*</td>''',
        section,
        re.VERBOSE
    )

    if not consult_cell:
        raise RuntimeError(
            "상세 상담 td 못 찾음"
        )

    original = consult_cell.group(0)

    actual = original.replace(
        "row.consultations",
        "row.actualSurgeries"
    )

    section = (
        section[:consult_cell.start()]
        + actual
        + "\n"
        + original
        + section[consult_cell.end():]
    )

# 헤더
if not re.search(
    r'<th[^>]*>\s*수술 수\s*</th>',
    section
):
    consult_th = re.search(
        r'<th[^>]*>\s*상담\s*</th>',
        section
    )

    if not consult_th:
        raise RuntimeError(
            "상세 상담 th 못 찾음"
        )

    original = consult_th.group(0)

    actual = re.sub(
        r'>\s*상담\s*<',
        '>수술 수<',
        original
    )

    section = (
        section[:consult_th.start()]
        + actual
        + "\n"
        + original
        + section[consult_th.end():]
    )

print("OK 4/4 상세 수술 수 추가")


# 섹션 다시 합치기
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
print("========================================")
print(" CONVERSION DASHBOARD FINAL FIX COMPLETE")
print("========================================")
print("8월 기대값")
print("수술 수    118")
print("상담       329")
print("수술 전환   42")
print("전환율     12.77%")
print("========================================")
print("backup:", bak.name)

