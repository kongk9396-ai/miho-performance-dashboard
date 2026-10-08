from pathlib import Path
from datetime import datetime
import shutil

p = Path("lib/db/queries.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_doctor_august_{stamp}")
shutil.copy2(p, bak)

if "const effectiveDoctorConversions =" in s:
    print("이미 원장별 fallback 적용되어 있음")
    raise SystemExit(0)

# 최종 return 직전에 삽입
needle = '''  return {
    selectedMonth:'''

pos = s.rfind(needle)

if pos < 0:
    raise RuntimeError(
        "getDashboardData 최종 return 위치를 찾지 못했습니다."
    )

fallback = r'''
  /*
   * ============================================
   * 2026-08 원장별 수술 전환율
   *
   * Excel 원본 기준 임시 fallback.
   * DB에 정상적인 원장 데이터가 들어오면 DB값을 우선 사용한다.
   * ============================================
   */
  const effectiveDoctorConversions =
    String(month).slice(0, 7) === "2026-08" &&
    (doctorConversions?.length ?? 0) === 0
      ? [
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
        ]
      : doctorConversions;

'''

s = s[:pos] + fallback + s[pos:]

# 최종 return의 doctorConversions만 effective로 교체
return_pos = s.rfind("  return {")

tail = s[return_pos:]

if "    doctorConversions," not in tail:
    raise RuntimeError(
        "최종 return에서 doctorConversions를 찾지 못했습니다."
    )

tail = tail.replace(
    "    doctorConversions,",
    "    doctorConversions: effectiveDoctorConversions,",
    1
)

s = s[:return_pos] + tail

p.write_text(s, encoding="utf-8")

print("")
print("====================================")
print(" AUGUST DOCTOR CONVERSION ADDED")
print("====================================")
print("S : 242 / 139 / 25")
print("J : 107 / 72 / 19")
print("T : 113 / 80  / 22")
print("DB 값 존재 시 DB 우선")
print("backup:", bak.name)
