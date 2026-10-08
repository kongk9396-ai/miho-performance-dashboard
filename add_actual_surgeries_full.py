from pathlib import Path
from datetime import datetime
import shutil
import re

files = [
    Path("lib/db/schema.ts"),
    Path("app/api/admin/import/preview/route.ts"),
    Path("app/api/admin/import/commit/route.ts"),
    Path("lib/db/queries.ts"),
    Path("components/DashboardClient.tsx"),
]

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

for p in files:
    shutil.copy2(
        p,
        Path(str(p) + f".bak_actual_surgery_full_{stamp}")
    )

# =========================================================
# 1. SCHEMA
# =========================================================

p = Path("lib/db/schema.ts")
s = p.read_text(encoding="utf-8-sig")

# dailyConversionStats 테이블 안에 actualSurgeries 추가
if "actualSurgeries:" not in s:
    pattern = re.compile(
        r'(export const dailyConversionStats = pgTable\([\s\S]*?consultations:\s*integer\([^\n]+\)[^\n]*,\s*)'
    )

    m = pattern.search(s)

    if not m:
        raise RuntimeError("dailyConversionStats 위치 못 찾음")

    insert = m.group(1) + '''
    actualSurgeries:
      integer("actual_surgeries")
        .notNull()
        .default(0),
'''

    s = s[:m.start()] + insert + s[m.end():]

p.write_text(s, encoding="utf-8")

print("SCHEMA OK")


# =========================================================
# 2. PREVIEW
# =========================================================

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

# 타입
s = s.replace(
'''type DailyConversionRow = {
  date: string;
  consultations: number;
  surgeries: number;
};''',
'''type DailyConversionRow = {
  date: string;
  actualSurgeries: number;
  consultations: number;
  surgeries: number;
};'''
)

# actualSurgeryCol 선언
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

# 헤더 탐색
needle = '''    if (
      text === "상담" ||
      text === "상담수" ||
      text === "상담건수"
    ) {
      consultationCol = c;
    }'''

if needle in s and 'text === "수술수"' not in s:
    s = s.replace(
        needle,
'''    if (
      text === "수술수" ||
      text === "수술건수" ||
      text === "실제수술"
    ) {
      actualSurgeryCol = c;
    }

''' + needle,
        1
    )

# 검증
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

# row push
old = '''    const consultations =
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

new = '''    const actualSurgeries =
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

if old not in s:
    raise RuntimeError("preview result.push 블록 못 찾음")

s = s.replace(old, new, 1)

# 월 실제 수술 합계
if "actualSurgeriesTotal" not in s:
    marker = '''        const totalApplications ='''

    pos = s.rfind(marker)

    if pos < 0:
        raise RuntimeError("preview totals 위치 못 찾음")

    block = '''        const actualSurgeriesTotal =
          dailyConversions.reduce(
            (sum, row) =>
              sum +
              (row.actualSurgeries ?? 0),
            0
          );

'''

    s = s[:pos] + block + s[pos:]

    s = s.replace(
'''          dailyConversions,
          consultations: item.consultations,''',
'''          dailyConversions,
          actualSurgeries: actualSurgeriesTotal,
          consultations: item.consultations,''',
1
)

p.write_text(s, encoding="utf-8")

print("PREVIEW OK")


# =========================================================
# 3. COMMIT
# =========================================================

p = Path("app/api/admin/import/commit/route.ts")
s = p.read_text(encoding="utf-8-sig")

# 타입
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
  }[];'''
)

# insert values
s = s.replace(
'''              date: row.date,
              consultations:
                safeNumber(row.consultations),
              surgeries:
                safeNumber(row.surgeries),''',
'''              date: row.date,
              actualSurgeries:
                safeNumber(row.actualSurgeries),
              consultations:
                safeNumber(row.consultations),
              surgeries:
                safeNumber(row.surgeries),''',
1
)

# upsert set
s = s.replace(
'''            set: {
              consultations:
                sql`excluded.consultations`,
              surgeries:
                sql`excluded.surgeries`,''',
'''            set: {
              actualSurgeries:
                sql`excluded.actual_surgeries`,
              consultations:
                sql`excluded.consultations`,
              surgeries:
                sql`excluded.surgeries`,''',
1
)

p.write_text(s, encoding="utf-8")

print("COMMIT OK")


# =========================================================
# 4. QUERIES
# =========================================================

p = Path("lib/db/queries.ts")
s = p.read_text(encoding="utf-8-sig")

# DB select
s = s.replace(
'''          consultations: dailyConversionStats.consultations,
          surgeries: dailyConversionStats.surgeries,''',
'''          actualSurgeries: dailyConversionStats.actualSurgeries,
          consultations: dailyConversionStats.consultations,
          surgeries: dailyConversionStats.surgeries,''',
1
)

# dailyConversions map
s = s.replace(
'''        date: row.date,
        consultations: row.consultations,
        surgeries: row.surgeries,''',
'''        date: row.date,
        actualSurgeries: row.actualSurgeries,
        consultations: row.consultations,
        surgeries: row.surgeries,''',
1
)

p.write_text(s, encoding="utf-8")

print("QUERIES OK")


# =========================================================
# 5. DASHBOARD TYPE + UI
# =========================================================

p = Path("components/DashboardClient.tsx")
s = p.read_text(encoding="utf-8-sig")

# 타입
s = s.replace(
'''  dailyConversions: {
    date: string;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];''',
'''  dailyConversions: {
    date: string;
    actualSurgeries: number;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];'''
)

# 일별 상세 헤더
s = s.replace(
'''<th className="px-3 py-3 text-right">상담</th>
                              <th className="px-3 py-3 text-right">수술 전환</th>''',
'''<th className="px-3 py-3 text-right">수술 수</th>
                              <th className="px-3 py-3 text-right">상담</th>
                              <th className="px-3 py-3 text-right">수술 전환</th>'''
)

# 일별 상세 row
needle = '''<td className="px-3 py-3 text-right font-bold">
                                    {row.consultations.toLocaleString()}
                                  </td>'''

if needle in s and "row.actualSurgeries" not in s:
    s = s.replace(
        needle,
'''<td className="px-3 py-3 text-right font-bold">
                                    {row.actualSurgeries.toLocaleString()}
                                  </td>

                                  ''' + needle,
        1
    )

p.write_text(s, encoding="utf-8")

print("DASHBOARD OK")

print("")
print("==========================================")
print(" ACTUAL SURGERIES FULL PIPELINE PATCHED")
print("==========================================")
