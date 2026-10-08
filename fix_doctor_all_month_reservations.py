from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("lib/db/queries.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_doctor_all_reservations_{stamp}")
shutil.copy2(p, bak)

# 기존 8월 전용 예약 보정 블록 제거
pattern = re.compile(
    r'''
    \s*/\*
     \s*\*\s*2026-08\s*상담예약\(DB포함\)[\s\S]*?
    effectiveDoctorConversions\s*=
      effectiveDoctorConversions\.map\([\s\S]*?
    \}\s*\);\s*
    \}
    ''',
    re.VERBOSE
)

s, count = pattern.subn("\n", s, count=1)

# doctorOrder 앞에 월별 예약값 보정 삽입
needle = '''  const doctorOrder:
    Record<string, number> = {
      S: 0,
      J: 1,
      T: 2,
    };'''

if needle not in s:
    raise RuntimeError(
        "doctorOrder 블록을 못 찾았습니다."
    )

block = r'''
  /*
   * ============================================
   * 상담예약(DB포함) 월별 Excel 원본값 보정
   *
   * 현재 DB에는 실제상담/수술결정은 들어가 있지만
   * 상담예약이 0으로 저장된 월이 있으므로
   * Excel 원본의 상담예약 값만 월별로 복원한다.
   * ============================================
   */
  const doctorReservationByMonth:
    Record<
      string,
      Record<string, number>
    > = {
      "2026-08": {
        S: 242,
        J: 107,
        T: 113,
      },

      "2026-07": {
        S: 278,
        J: 129,
        T: 150,
      },

      "2026-06": {
        S: 589,
        J: 280,
        T: 315,
      },

      "2026-05": {
        S: 727,
        J: 399,
        T: 346,
      },

      "2026-04": {
        S: 647,
        J: 384,
        T: 411,
      },

      "2026-03": {
        S: 886,
        J: 417,
        T: 296,
      },

      "2026-02": {
        S: 331,
        J: 120,
        T: 201,
      },
    };

  const selectedMonthKey =
    String(month).slice(0, 7);

  const selectedReservationMap =
    doctorReservationByMonth[
      selectedMonthKey
    ];

  if (selectedReservationMap) {
    effectiveDoctorConversions =
      effectiveDoctorConversions.map(
        (row) => {
          const reservations =
            selectedReservationMap[
              row.doctorName
            ] ??
            row.reservations;

          return {
            ...row,

            reservations,

            reservationRate:
              reservations > 0
                ? (
                    row.surgeries /
                    reservations
                  ) * 100
                : 0,
          };
        }
      );
  }

'''

s = s.replace(
    needle,
    block + needle,
    1
)

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("==========================================")
print(" DOCTOR RESERVATIONS ALL MONTHS FIXED")
print("==========================================")
print("2026-08 S242 J107 T113")
print("2026-07 S278 J129 T150")
print("2026-06 S589 J280 T315")
print("2026-05 S727 J399 T346")
print("2026-04 S647 J384 T411")
print("2026-03 S886 J417 T296")
print("2026-02 S331 J120 T201")
print("==========================================")
print("backup:", bak.name)
