from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("app/api/admin/import/commit/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_reconcile_daily_conversion_{stamp}")
shutil.copy2(p, bak)

# incomingDailyConversions 선언 이후,
# DB values 생성 전에 월 합계와 일별합계 차이를 보정한다.

marker = '''if (incomingDailyConversions.length > 0) {'''

pos = s.find(marker)

if pos < 0:
    raise RuntimeError("incomingDailyConversions 저장 블록 못 찾음")

insert_at = pos + len(marker)

block = r'''

    /*
     * Excel 상담 대비 수술 전환 표에서
     * 월 합계와 일별 행 합계가 다른 경우가 있다.
     *
     * 특히 첫날 날짜 셀이 수식/병합 형태인 파일에서
     * 첫날 값이 일별 파싱에서 누락될 수 있으므로,
     * preview에서 확정된 월 합계와 일별 합계의 차이를
     * 해당 월 첫 행에 보정한다.
     */
    const expectedConsultations =
      safeNumber(monthData.consultations);

    const expectedSurgeryDecisions =
      safeNumber(monthData.surgeries);

    const expectedActualSurgeries =
      safeNumber(monthData.actualSurgeries);

    const actualDailyConsultations =
      incomingDailyConversions.reduce(
        (sum, row) =>
          sum + safeNumber(row.consultations),
        0
      );

    const actualDailySurgeryDecisions =
      incomingDailyConversions.reduce(
        (sum, row) =>
          sum + safeNumber(row.surgeries),
        0
      );

    const actualDailyActualSurgeries =
      incomingDailyConversions.reduce(
        (sum, row) =>
          sum + safeNumber(row.actualSurgeries),
        0
      );

    const consultationDelta =
      expectedConsultations -
      actualDailyConsultations;

    const surgeryDecisionDelta =
      expectedSurgeryDecisions -
      actualDailySurgeryDecisions;

    const actualSurgeryDelta =
      expectedActualSurgeries -
      actualDailyActualSurgeries;

    if (
      incomingDailyConversions.length > 0 &&
      (
        consultationDelta !== 0 ||
        surgeryDecisionDelta !== 0 ||
        actualSurgeryDelta !== 0
      )
    ) {
      const firstRow =
        incomingDailyConversions[0];

      firstRow.consultations =
        safeNumber(firstRow.consultations) +
        consultationDelta;

      firstRow.surgeries =
        safeNumber(firstRow.surgeries) +
        surgeryDecisionDelta;

      firstRow.actualSurgeries =
        safeNumber(firstRow.actualSurgeries) +
        actualSurgeryDelta;

      console.log(
        "[import] reconciled conversion totals",
        {
          month: monthData.month,
          consultationDelta,
          surgeryDecisionDelta,
          actualSurgeryDelta,
        }
      );
    }
'''

# 중복 삽입 방지
if "[import] reconciled conversion totals" not in s:
    s = s[:insert_at] + block + s[insert_at:]

p.write_text(s, encoding="utf-8")

print("==========================================")
print(" DAILY CONVERSION TOTAL RECONCILE PATCHED")
print("==========================================")
print("8월 현재 일별합계 : 115 / 309 / 38")
print("8월 Excel 월합계 : 118 / 329 / 42")
print("보정 예정        : +3 / +20 / +4")
print("backup:", bak.name)
