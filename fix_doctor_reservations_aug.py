from pathlib import Path
from datetime import datetime
import shutil

p = Path("lib/db/queries.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_doctor_reservation_fix_{stamp}")
shutil.copy2(p, bak)

needle = '''  effectiveDoctorConversions.sort(
    (a, b) =>
      (
        doctorOrder[
          a.doctorName
        ] ?? 99
      ) -
      (
        doctorOrder[
          b.doctorName
        ] ?? 99
      )
  );'''

replacement = '''  /*
   * 2026-08 상담예약(DB포함) 원본값 보정
   *
   * 현재 doctor_conversion_stats에
   * 실제상담/수술결정은 정상인데
   * 상담예약만 0으로 저장된 상태이므로
   * Excel 원본 예약값만 복원한다.
   */
  if (
    String(month).slice(0, 7) === "2026-08"
  ) {
    const augustReservations:
      Record<string, number> = {
        S: 242,
        J: 107,
        T: 113,
      };

    effectiveDoctorConversions =
      effectiveDoctorConversions.map(
        (row) => {
          const reservations =
            augustReservations[
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

  effectiveDoctorConversions.sort(
    (a, b) =>
      (
        doctorOrder[
          a.doctorName
        ] ?? 99
      ) -
      (
        doctorOrder[
          b.doctorName
        ] ?? 99
      )
  );'''

if needle not in s:
    raise RuntimeError(
        "원장 정렬 블록을 찾지 못했습니다. 파일 수정 안 함."
    )

s = s.replace(
    needle,
    replacement,
    1
)

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("====================================")
print(" DOCTOR RESERVATIONS FIXED")
print("====================================")
print("S = 242")
print("J = 107")
print("T = 113")
print("총 상담예약 = 462")
print("예상 예약→수술 = 14.29%")
print("====================================")
