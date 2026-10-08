from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_FINAL_CONVERSION_UI_{stamp}")
shutil.copy2(p, bak)

# =========================================================
# 상담 대비 수술 전환 섹션만 작업
# =========================================================

start = s.find("상담 대비 수술 전환")
end = s.find("원장별 수술 전환율", start)

if start < 0 or end < 0:
    raise RuntimeError("섹션 경계를 못 찾았습니다.")

before = s[:start]
section = s[start:end]
after = s[end:]


# =========================================================
# JSX div 블록 추출
# =========================================================

def find_parent_div(text, inside_pos):
    starts = [
        m.start()
        for m in re.finditer(r"<div\b", text[:inside_pos])
    ]

    for candidate in reversed(starts):
        token = re.compile(r"<div\b[^>]*>|</div>")
        depth = 0

        for m in token.finditer(text, candidate):
            if m.group(0).startswith("<div"):
                depth += 1
            else:
                depth -= 1

                if depth == 0:
                    if m.end() >= inside_pos:
                        return candidate, m.end()
                    break

    return None


# =========================================================
# 1. 기존 3개 KPI 카드 위치 탐색
# =========================================================

labels = [
    "상담",
    "수술 전환",
    "상담 → 수술 전환율",
]

cards = []

for label in labels:
    m = re.search(
        rf">\s*{re.escape(label)}\s*<",
        section
    )

    if not m:
        raise RuntimeError(
            f"기존 카드 '{label}'를 못 찾았습니다."
        )

    card = find_parent_div(
        section,
        m.start()
    )

    if not card:
        raise RuntimeError(
            f"'{label}' 카드 범위를 못 찾았습니다."
        )

    cards.append(card)


cards.sort(key=lambda x: x[0])

first_card_start = cards[0][0]
last_card_end = cards[-1][1]


# =========================================================
# 2. 기존 카드 스타일 가져오기
# =========================================================

sample_card = section[
    cards[0][0]:
    cards[0][1]
]

# 가장 바깥 div 여는 태그만 재사용
open_tag_match = re.match(
    r"(<div\b[^>]*>)",
    sample_card
)

if not open_tag_match:
    raise RuntimeError(
        "카드 스타일을 읽지 못했습니다."
    )

card_open = open_tag_match.group(1)


# =========================================================
# 3. 4개 카드 새로 생성
#
# 상담/수술결정/전환율:
#   current 월 확정값 사용
#
# 수술 수:
#   actualSurgeries 일별 합계
# =========================================================

new_cards = f'''
{card_open}
  <p className="text-sm font-medium text-zinc-500">
    수술 수
  </p>

  <div className="mt-2 flex items-end gap-1">
    <strong className="text-3xl font-black text-zinc-950">
      {{rows
        .reduce(
          (sum, row) =>
            sum + Number(row.actualSurgeries ?? 0),
          0
        )
        .toLocaleString()}}
    </strong>

    <span className="pb-1 text-sm text-zinc-400">
      건
    </span>
  </div>
</div>

{card_open}
  <p className="text-sm font-medium text-zinc-500">
    상담 수
  </p>

  <div className="mt-2 flex items-end gap-1">
    <strong className="text-3xl font-black text-zinc-950">
      {{current.consultations.toLocaleString()}}
    </strong>

    <span className="pb-1 text-sm text-zinc-400">
      건
    </span>
  </div>
</div>

{card_open}
  <p className="text-sm font-medium text-zinc-500">
    수술 결정
  </p>

  <div className="mt-2 flex items-end gap-1">
    <strong className="text-3xl font-black text-zinc-950">
      {{current.surgeries.toLocaleString()}}
    </strong>

    <span className="pb-1 text-sm text-zinc-400">
      건
    </span>
  </div>
</div>

{card_open}
  <p className="text-sm font-medium text-blue-600">
    수술 전환율
  </p>

  <div className="mt-2">
    <strong className="text-3xl font-black text-blue-600">
      {{current.surgeryRate.toFixed(2)}}%
    </strong>
  </div>
</div>
'''

section = (
    section[:first_card_start]
    + new_cards
    + section[last_card_end:]
)

print("OK 1/3: KPI 카드 완전 교체")


# =========================================================
# 4. KPI grid 4칸
# =========================================================

# 새 카드 앞에서 가장 가까운 grid class 수정
grid_pos = section.rfind(
    'className="',
    0,
    first_card_start
)

# 섹션 전체에서 첫 md:grid-cols-3을 4로 변경
section = section.replace(
    "md:grid-cols-3",
    "md:grid-cols-4",
    1
)

print("OK 2/3: 4열 카드")


# =========================================================
# 5. 상세 테이블
# 일자 | 수술 수 | 상담 수 | 수술 결정 | 수술 전환율
# =========================================================

# 헤더명 변경
section = re.sub(
    r'>\s*상담\s*</th>',
    '>상담 수</th>',
    section
)

section = re.sub(
    r'>\s*수술 전환\s*</th>',
    '>수술 결정</th>',
    section
)

section = re.sub(
    r'>\s*전환율\s*</th>',
    '>수술 전환율</th>',
    section
)

# 수술 수 헤더가 없다면 상담 수 앞에 삽입
if not re.search(
    r'>\s*수술 수\s*</th>',
    section
):
    m = re.search(
        r'(<th[^>]*>\s*상담 수\s*</th>)',
        section
    )

    if m:
        consult_th = m.group(1)

        actual_th = re.sub(
            r'>\s*상담 수\s*<',
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


# actualSurgeries 셀이 없으면 상담 셀 앞에 삽입
if "row.actualSurgeries.toLocaleString()" not in section:

    m = re.search(
        r'''(<td[^>]*>\s*
             \{row\.consultations\.toLocaleString\(\)\}
             \s*</td>)''',
        section,
        re.VERBOSE
    )

    if m:
        consult_td = m.group(1)

        actual_td = consult_td.replace(
            "row.consultations",
            "row.actualSurgeries"
        )

        section = (
            section[:m.start()]
            + actual_td
            + "\n"
            + consult_td
            + section[m.end():]
        )

print("OK 3/3: 상세 표 정리")


# =========================================================
# 원장별 섹션은 원문 그대로 붙임
# =========================================================

s = before + section + after

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("==========================================")
print(" FINAL CONVERSION UI COMPLETE")
print("==========================================")
print("상담 대비 수술 전환:")
print("수술 수 / 상담 수 / 수술 결정 / 수술 전환율")
print("")
print("8월 목표:")
print("118 / 329 / 42 / 12.77%")
print("")
print("원장별 수술 전환율:")
print("수정하지 않음")
print("==========================================")
print("backup:", bak.name)

