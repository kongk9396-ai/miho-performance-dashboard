from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("lib/db/queries.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_doctor_month_fix_{stamp}")
shutil.copy2(p, bak)

new_block = r'''
  /*
   * ============================================
   * 원장별 수술 전환율
   * 선택 월 데이터만 집계
   * ============================================
   */
  const selectedDoctorRows =
    doctorConversionRows.filter(
      (row) =>
        String(
          monthFromDate(row.date)
        ).slice(0, 7) ===
        String(month).slice(0, 7)
    );

  const selectedDoctorMap =
    new Map<
      string,
      {
        doctorName: string;
        reservations: number;
        consultations: number;
        surgeries: number;
      }
    >();

  for (
    const row of selectedDoctorRows
  ) {
    const doctorName =
      String(
        row.doctorName ?? ""
      ).trim();

    if (!doctorName) {
      continue;
    }

    const current =
      selectedDoctorMap.get(
        doctorName
      ) ?? {
        doctorName,
        reservations: 0,
        consultations: 0,
        surgeries: 0,
      };

    current.reservations +=
      Number(
        row.reservations ?? 0
      );

    current.consultations +=
      Number(
        row.consultations ?? 0
      );

    current.surgeries +=
      Number(
        row.surgeries ?? 0
      );

    selectedDoctorMap.set(
      doctorName,
      current
    );
  }

  let effectiveDoctorConversions =
    Array.from(
      selectedDoctorMap.values()
    ).map(
      (row) => ({
        ...row,

        reservationRate:
          row.reservations > 0
            ? (
                row.surgeries /
                row.reservations
              ) * 100
            : 0,

        consultationRate:
          row.consultations > 0
            ? (
                row.surgeries /
                row.consultations
              ) * 100
            : 0,
      })
    );

  /*
   * 8월 DB 원장 데이터가 아직 없다면
   * Excel 원본값으로 임시 fallback.
   */
  if (
    String(month).slice(0, 7) ===
      "2026-08" &&
    effectiveDoctorConversions.length ===
      0
  ) {
    effectiveDoctorConversions = [
      {
        doctorName: "S",
        reservations: 242,
        consultations: 139,
        surgeries: 25,
        reservationRate:
          (25 / 242) * 100,
        consultationRate:
          (25 / 139) * 100,
      },
      {
        doctorName: "J",
        reservations: 107,
        consultations: 72,
        surgeries: 19,
        reservationRate:
          (19 / 107) * 100,
        consultationRate:
          (19 / 72) * 100,
      },
      {
        doctorName: "T",
        reservations: 113,
        consultations: 80,
        surgeries: 22,
        reservationRate:
          (22 / 113) * 100,
        consultationRate:
          (22 / 80) * 100,
      },
    ];
  }

  /*
   * 원장 순서 고정: S → J → T
   */
  const doctorOrder:
    Record<string, number> = {
      S: 0,
      J: 1,
      T: 2,
    };

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
  );

'''

# 기존 effectiveDoctorConversions 블록이 있으면 통째로 교체
pattern = re.compile(
    r'''
    \n\s*const\s+effectiveDoctorConversions\s*=
    [\s\S]*?
    (?=\n\s*return\s*\{)
    ''',
    re.VERBOSE
)

if pattern.search(s):
    s = pattern.sub(
        "\n" + new_block,
        s,
        count=1
    )
else:
    # 없으면 getDashboardData 마지막 return 직전에 삽입
    pos = s.rfind(
        "  return {"
    )

    if pos < 0:
        raise RuntimeError(
            "최종 return 위치를 못 찾음"
        )

    s = (
        s[:pos]
        + new_block
        + s[pos:]
    )

# 최종 return에서 doctorConversions가
# effectiveDoctorConversions를 반환하도록 보장
return_pos = s.rfind(
    "  return {"
)

tail = s[return_pos:]

if (
    "doctorConversions: effectiveDoctorConversions"
    not in tail
):
    if "    doctorConversions," in tail:
        tail = tail.replace(
            "    doctorConversions,",
            "    doctorConversions: effectiveDoctorConversions,",
            1
        )
    else:
        # dailyConversions 뒤에 삽입
        if "    dailyConversions," not in tail:
            raise RuntimeError(
                "최종 반환부 doctor 위치 못 찾음"
            )

        tail = tail.replace(
            "    dailyConversions,",
            "    dailyConversions,\n    doctorConversions: effectiveDoctorConversions,",
            1
        )

    s = (
        s[:return_pos]
        + tail
    )

p.write_text(
    s,
    encoding="utf-8"
)

print("")
print("======================================")
print(" DOCTOR MONTH FILTER FIXED")
print("======================================")
print("선택 월만 집계")
print("순서 S -> J -> T")
print("8월 fallback:")
print("S 242 / 139 / 25")
print("J 107 / 72 / 19")
print("T 113 / 80 / 22")
print("backup:", bak.name)
