from pathlib import Path
from datetime import datetime
import shutil

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_daily_platform_total_{stamp}")
shutil.copy2(p, bak)

old = '''        const totalApplications = platforms.reduce(
          (sum, row) => sum + row.applications,
          0
        );
        const totalReservations = platforms.reduce(
          (sum, row) => sum + row.reservations,
          0
        );'''

new = '''        /*
         * 일별 플랫폼 데이터가 있는 월은
         * Excel의 "일일 합계"와 동일하게
         * dailyPlatforms 합계를 최우선으로 사용한다.
         *
         * 일별 데이터가 없는 과거 월만
         * 기존 월간 플랫폼 합계를 fallback으로 사용.
         */
        const totalApplications =
          dailyPlatforms.length > 0
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
          dailyPlatforms.length > 0
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

if old not in s:
    raise RuntimeError(
        "미리보기 합계 계산 블록을 못 찾았습니다. 파일 수정 안 함."
    )

s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

print("")
print("====================================")
print(" PREVIEW DAILY TOTAL FIXED")
print("====================================")
print("일별 데이터 존재 -> dailyPlatforms 합계")
print("일별 데이터 없음 -> monthly platforms 합계")
print("6월 예상: 신청 681 / 예약 525 / 77.09%")
print("backup:", bak.name)
