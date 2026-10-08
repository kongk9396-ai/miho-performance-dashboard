from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_june_only_total_{stamp}")
shutil.copy2(p, bak)

# 방금 넣었던 dailyPlatforms 우선 합계 블록을 찾는다.
pattern = re.compile(
    r'''        /\*
         \s*\*\s*일별 플랫폼 데이터가 있는 월은[\s\S]*?
        const totalReservations =
          dailyPlatforms\.length > 0
            \? dailyPlatforms\.reduce\(
                \(sum, row\) =>
                  sum \+ row\.reservations,
                0
              \)
            : platforms\.reduce\(
                \(sum, row\) =>
                  sum \+ row\.reservations,
                0
              \);''',
    re.VERBOSE
)

replacement = '''        /*
         * 기본은 기존 월간 플랫폼 합계 사용.
         *
         * 단, 2026년 6월은 Excel 원본의 월간 플랫폼 표와
         * "일일 합계"가 서로 달라서 일일 데이터를 기준으로 사용.
         */
        const useDailyTotal =
          String(item.month).slice(0, 7) === "2026-06" &&
          dailyPlatforms.length > 0;

        const totalApplications =
          useDailyTotal
            ? dailyPlatforms.reduce(
                (sum, row) =>
                  sum + row.applications,
                0
              )
            : platforms.reduce(
                (sum, row) =>
                  sum + row.applications,
                0
              );

        const totalReservations =
          useDailyTotal
            ? dailyPlatforms.reduce(
                (sum, row) =>
                  sum + row.reservations,
                0
              )
            : platforms.reduce(
                (sum, row) =>
                  sum + row.reservations,
                0
              );'''

new_s, count = pattern.subn(
    replacement,
    s,
    count=1
)

if count == 0:
    # 형태가 조금 달라졌을 경우 totalApplications~totalReservations 직접 교체
    pattern2 = re.compile(
        r'''        const totalApplications =
          dailyPlatforms\.length > 0[\s\S]*?
        const totalReservations =
          dailyPlatforms\.length > 0[\s\S]*?
              \);''',
        re.VERBOSE
    )

    new_s, count = pattern2.subn(
        replacement,
        s,
        count=1
    )

if count != 1:
    raise RuntimeError(
        "현재 합계 계산 블록을 찾지 못했습니다. 파일은 수정하지 않았습니다."
    )

p.write_text(new_s, encoding="utf-8")

print("")
print("======================================")
print(" JUNE ONLY DAILY TOTAL FIXED")
print("======================================")
print("8월 -> 기존 월간 합계 686 / 472")
print("7월 -> 기존 월간 합계 782 / 503")
print("6월 -> 일일 합계     681 / 525")
print("======================================")
print("backup:", bak.name)
