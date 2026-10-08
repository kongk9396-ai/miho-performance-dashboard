from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_conversion_realfinal_{stamp}")
shutil.copy2(p, bak)

# =========================================================
# 1. 상담 대비 수술 전환 섹션만 자르기
# =========================================================

section_start = s.find("상담 대비 수술 전환")
section_end = s.find("원장별 수술 전환율", section_start)

if section_start < 0 or section_end < 0:
    raise RuntimeError("상담/원장 섹션 경계 못 찾음")

section = s[section_start:section_end]

# =========================================================
# 2. 현재 실제 KPI 계산부 정확히 제거
# =========================================================

calc_start = section.find("const dailyConsultations")

if calc_start < 0:
    raise RuntimeError("dailyConsultations 위치 못 찾음")

rate_start = section.find("const totalRate", calc_start)

if rate_start < 0:
    raise RuntimeError("totalRate 위치 못 찾음")

# totalRate 문의 끝 세미콜론까지 찾음
rate_end = section.find(";", rate_start)

if rate_end < 0:
    raise RuntimeError("totalRate 끝 못 찾음")

rate_end += 1

new_calc = '''const totalActualSurgeries =
                    rows.reduce(
                      (sum, row) =>
                        sum + Number(row.actualSurgeries ?? 0),
                      0
                    );

                  /*
                   * 월 KPI는 월 확정값 사용.
                   * 일별 rows를 다시 합산하지 않음.
                   */
                  const totalConsultations =
                    current.consultations;

                  const totalSurgeries =
                    current.surgeries;

                  const totalRate =
                    totalConsultations > 0
                      ? (totalSurgeries / totalConsultations) * 100
                      : 0;'''

section = (
    section[:calc_start]
    + new_calc
    + section[rate_end:]
)

print("OK 1/4 KPI 계산 교체")

# =========================================================
# 3. 카드 grid 3칸 → 4칸
# =========================================================

section = section.replace(
    "md:grid-cols-3",
    "md:grid-cols-4",
    1
)

print("OK 2/4 카드 4칸")

# =========================================================
# 4. 상담 카드 앞에 '수술 수' 카드 복제
#    값 표현식 totalConsultations을 기준으로 찾음
# =========================================================

if ">수술 수<" not in section and ">수술 수 <" not in section:

    value_pos = section.find("totalConsultations")

    if value_pos < 0:
        raise RuntimeError("상담 카드 totalConsultations 위치 못 찾음")

    # totalConsultations가 들어있는 가장 가까운 div 시작
    card_start = section.rfind("<div", 0, value_pos)

    if card_start < 0:
        raise RuntimeError("상담 카드 시작 못 찾음")

    # div depth로 카드 끝 탐색
    i = card_start
    depth = 0
    card_end = -1

    while i < len(section):
        open_pos = section.find("<div", i)
        close_pos = section.find("</div>", i)

        if close_pos < 0:
            break

        if open_pos >= 0 and open_pos < close_pos:
            depth += 1
            i = open_pos + 4
        else:
            depth -= 1
            i = close_pos + 6

            if depth == 0:
                card_end = i
                break

    if card_end < 0:
        raise RuntimeError("상담 카드 끝 못 찾음")

    consult_card = section[card_start:card_end]

    actual_card = consult_card

    # 상담 라벨 → 수술 수
    actual_card = actual_card.replace(
        ">상담<",
        ">수술 수<",
        1
    )

    # 값 → actual surgery
    actual_card = actual_card.replace(
        "totalConsultations.toLocaleString()",
        "totalActualSurgeries.toLocaleString()",
        1
    )

    if "totalActualSurgeries" not in actual_card:
        actual_card = actual_card.replace(
            "totalConsultations",
            "totalActualSurgeries",
            1
        )

    if "totalActualSurgeries" not in actual_card:
        raise RuntimeError("수술 수 카드 값 교체 실패")

    section = (
        section[:card_start]
        + actual_card
        + "\n"
        + section[card_start:]
    )

print("OK 3/4 수술 수 카드")

# =========================================================
# 5. 상세 테이블
# 일자 | 수술 수 | 상담 | 수술 전환 | 전환율
# =========================================================

# 상담 td 앞에 actualSurgeries td
if "row.actualSurgeries.toLocaleString()" not in section:

    target = "{row.consultations.toLocaleString()}"

    pos = section.find(target)

    if pos < 0:
        raise RuntimeError("상세 상담 값 못 찾음")

    td_start = section.rfind("<td", 0, pos)
    td_end = section.find("</td>", pos)

    if td_start < 0 or td_end < 0:
        raise RuntimeError("상세 상담 td 범위 못 찾음")

    td_end += len("</td>")

    consult_td = section[td_start:td_end]

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

# 상담 th 앞에 수술 수 th
if ">수술 수</th>" not in section:

    # 상담 헤더만 찾기
    th_marker = ">상담</th>"
    pos = section.find(th_marker)

    if pos < 0:
        # 공백 있는 JSX 대응
        th_marker = ">상담 </th>"
        pos = section.find(th_marker)

    if pos >= 0:
        th_start = section.rfind("<th", 0, pos)
        th_end = section.find("</th>", pos)

        if th_start >= 0 and th_end >= 0:
            th_end += len("</th>")

            consult_th = section[th_start:th_end]

            actual_th = consult_th.replace(
                "상담",
                "수술 수",
                1
            )

            section = (
                section[:th_start]
                + actual_th
                + "\n"
                + consult_th
                + section[th_end:]
            )

print("OK 4/4 상세 테이블")

# =========================================================
# 다시 합치기
# =========================================================

s = s[:section_start] + section + s[section_end:]

p.write_text(s, encoding="utf-8")

print("")
print("========================================")
print(" REAL FINAL DASHBOARD PATCH COMPLETE")
print("========================================")
print("8월 목표:")
print("수술 수 118")
print("상담 329")
print("수술 전환 42")
print("전환율 12.77%")
print("backup:", bak.name)

