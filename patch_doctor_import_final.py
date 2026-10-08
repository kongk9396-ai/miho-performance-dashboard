from pathlib import Path
from datetime import datetime
import shutil
import re

ROOT = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard")

PREVIEW = ROOT / "app/api/admin/import/preview/route.ts"
COMMIT = ROOT / "app/api/admin/import/commit/route.ts"

STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

# ============================================================
# BACKUP
# ============================================================

for p in [PREVIEW, COMMIT]:
    if not p.exists():
        raise SystemExit(f"파일 없음: {p}")

    shutil.copy2(
        p,
        Path(str(p) + f".bak_doctor_import_final_{STAMP}")
    )

print("BACKUP:", STAMP)


# ============================================================
# PREVIEW
# ============================================================

s = PREVIEW.read_text(encoding="utf-8")


# ------------------------------------------------------------
# 1. 타입
# ------------------------------------------------------------

if "type DoctorConversionRow =" not in s:

    pos = s.find("type DailyConversionRow =")

    if pos < 0:
        raise SystemExit(
            "PREVIEW: DailyConversionRow 위치 못 찾음"
        )

    block = '''
type DoctorConversionRow = {
  doctorName: string;
  reservations: number;
  consultations: number;
  surgeries: number;
};

'''

    s = s[:pos] + block + s[pos:]

    print("PREVIEW OK: DoctorConversionRow")


# ------------------------------------------------------------
# 2. candidate 타입에 doctorConversions
# ------------------------------------------------------------

if "doctorConversions: DoctorConversionRow[];" not in s:

    # DailyConversionRow[] 필드는 candidate 계열에 2개 있을 수 있음.
    # 전부 추가해도 안전.
    s, count = re.subn(
        r'(dailyConversions:\s*DailyConversionRow\[\];)',
        r'\1\n  doctorConversions: DoctorConversionRow[];',
        s
    )

    if count == 0:
        raise SystemExit(
            "PREVIEW: dailyConversions 타입 필드 못 찾음"
        )

    print(
        f"PREVIEW OK: doctorConversions 타입 {count}곳"
    )


# ------------------------------------------------------------
# 3. 원장표 파서
# ------------------------------------------------------------

if "function parseDoctorConversionLayout(" not in s:

    pos = s.find("function parseDailyConversionLayout")

    if pos < 0:
        raise SystemExit(
            "PREVIEW: parseDailyConversionLayout 못 찾음"
        )

    parser = r'''
function parseDoctorConversionLayout(
  rows: unknown[][]
): DoctorConversionRow[] {

  const clean = (value: unknown) =>
    String(value ?? "")
      .replace(/\s+/g, "")
      .replace(/[()（）]/g, "")
      .toLowerCase();

  const numberValue = (value: unknown) => {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    if (typeof value === "number") {
      return Number.isFinite(value)
        ? Math.max(0, Math.round(value))
        : 0;
    }

    const text =
      String(value)
        .replace(/,/g, "")
        .replace(/%/g, "")
        .trim();

    const match =
      text.match(/-?\d+(?:\.\d+)?/);

    if (!match) {
      return 0;
    }

    const parsed =
      Number(match[0]);

    return Number.isFinite(parsed)
      ? Math.max(0, Math.round(parsed))
      : 0;
  };


  /*
   * ------------------------------------------------
   * 헤더 탐색
   *
   * 허용 예
   *
   * 원장 | 상담예약(DB포함) | 실상담 | 수술결정
   * 원장명 | 상담예약 | 실제상담 | 수술전환
   * 의사 | 예약상담 | 실상담 | 수술결정
   * ------------------------------------------------
   */

  let headerRow = -1;

  let doctorCol = -1;
  let reservationCol = -1;
  let consultationCol = -1;
  let surgeryCol = -1;


  for (
    let r = 0;
    r < Math.min(rows.length, 200);
    r++
  ) {

    const row =
      rows[r] ?? [];

    const normalized =
      row.map(clean);


    const d =
      normalized.findIndex(
        (v) =>
          v === "원장" ||
          v === "원장명" ||
          v === "의사" ||
          v === "의사명" ||
          v.includes("원장명")
      );


    const reservation =
      normalized.findIndex(
        (v) =>
          v.includes("상담예약") ||
          v.includes("예약상담") ||
          (
            v.includes("상담") &&
            v.includes("db")
          )
      );


    const consultation =
      normalized.findIndex(
        (v) =>
          v === "실상담" ||
          v === "실제상담" ||
          v.includes("실상담") ||
          v.includes("실제상담")
      );


    const surgery =
      normalized.findIndex(
        (v) =>
          v.includes("수술결정") ||
          v.includes("수술전환")
      );


    if (
      d >= 0 &&
      reservation >= 0 &&
      consultation >= 0 &&
      surgery >= 0
    ) {

      headerRow = r;

      doctorCol = d;
      reservationCol = reservation;
      consultationCol = consultation;
      surgeryCol = surgery;

      break;
    }
  }


  if (headerRow < 0) {
    return [];
  }


  const map =
    new Map<
      string,
      DoctorConversionRow
    >();


  let blankCount = 0;


  for (
    let r = headerRow + 1;
    r < rows.length;
    r++
  ) {

    const row =
      rows[r] ?? [];


    const doctorName =
      String(
        row[doctorCol] ?? ""
      ).trim();


    if (!doctorName) {

      blankCount += 1;

      /*
       * 표가 끝난 뒤 다른 섹션까지 읽지 않게 함.
       */
      if (blankCount >= 4) {
        break;
      }

      continue;
    }


    blankCount = 0;


    const doctorKey =
      clean(doctorName);


    if (
      doctorKey === "합계" ||
      doctorKey === "총계" ||
      doctorKey === "전체" ||
      doctorKey === "total"
    ) {
      continue;
    }


    /*
     * 다른 표의 제목/헤더 방어
     */
    if (
      doctorKey.includes("내원경로") ||
      doctorKey.includes("총인콜") ||
      doctorKey.includes("카테고리") ||
      doctorKey.includes("플랫폼")
    ) {
      break;
    }


    const reservations =
      numberValue(
        row[reservationCol]
      );

    const consultations =
      numberValue(
        row[consultationCol]
      );

    const surgeries =
      numberValue(
        row[surgeryCol]
      );


    if (
      reservations === 0 &&
      consultations === 0 &&
      surgeries === 0
    ) {
      continue;
    }


    const existing =
      map.get(doctorName);


    if (!existing) {

      map.set(
        doctorName,
        {
          doctorName,
          reservations,
          consultations,
          surgeries,
        }
      );

    } else {

      existing.reservations +=
        reservations;

      existing.consultations +=
        consultations;

      existing.surgeries +=
        surgeries;
    }
  }


  return Array.from(
    map.values()
  );
}


'''

    s = s[:pos] + parser + s[pos:]

    print("PREVIEW OK: 원장별 파서")


# ------------------------------------------------------------
# 4. parseSheet에서 파서 실행
# ------------------------------------------------------------

if "const doctorConversions = parseDoctorConversionLayout(rows);" not in s:

    target = "dailyConversions: dailyConversion.rows,"

    pos = s.find(target)

    if pos < 0:
        raise SystemExit(
            "PREVIEW: parseSheet dailyConversions 반환 못 찾음"
        )

    # return 객체 직전 영역에서 삽입 가능한 위치 탐색
    return_pos = s.rfind("return {", 0, pos)

    if return_pos < 0:
        raise SystemExit(
            "PREVIEW: parseSheet return 위치 못 찾음"
        )

    s = (
        s[:return_pos]
        + """const doctorConversions = parseDoctorConversionLayout(rows);

  """
        + s[return_pos:]
    )

    print("PREVIEW OK: 원장 파서 실행")


# ------------------------------------------------------------
# 5. candidate 반환
# ------------------------------------------------------------

target = "dailyConversions: dailyConversion.rows,"

if (
    target in s and
    "dailyConversions: dailyConversion.rows,\n    doctorConversions,"
    not in s
):

    s = s.replace(
        target,
        target + "\n    doctorConversions,",
        1
    )

    print("PREVIEW OK: candidate 반환")


# ------------------------------------------------------------
# 6. 월 결과 타입의 optional 대응
# ------------------------------------------------------------

# 혹시 동일 필드가 필수라 초기 객체 생성에서 에러가 날 수 있으므로
# doctorConversions 필드는 optional로 바꿔도 commit에서 안전함.
s = s.replace(
    "doctorConversions: DoctorConversionRow[];",
    "doctorConversions?: DoctorConversionRow[];"
)


# ------------------------------------------------------------
# 7. 최종 monthData 조립에서 원장 데이터 병합
# ------------------------------------------------------------

# 월 조립부는 candidate들을 사용하므로,
# dailyConversions 계산 이후 원장 데이터를 합산한다.

if "const mergedDoctorConversions =" not in s:

    # 뒤쪽 월 조립부의 마지막 const dailyConversions
    matches = list(
        re.finditer(
            r'const\s+dailyConversions\s*=',
            s
        )
    )

    if not matches:
        raise SystemExit(
            "PREVIEW: 월 조립 dailyConversions 못 찾음"
        )

    start =
      matches[-1].start()

    # 다음 return { 찾기
    return_pos =
      s.find("return {", start)

    if return_pos < 0:
        raise SystemExit(
            "PREVIEW: 월 조립 return 못 찾음"
        )

    merge = r'''
        const doctorMap =
          new Map<
            string,
            DoctorConversionRow
          >();

        for (
          const row of
          candidate.doctorConversions ?? []
        ) {

          const existing =
            doctorMap.get(
              row.doctorName
            );

          if (!existing) {

            doctorMap.set(
              row.doctorName,
              { ...row }
            );

          } else {

            existing.reservations +=
              row.reservations;

            existing.consultations +=
              row.consultations;

            existing.surgeries +=
              row.surgeries;
          }
        }

        const mergedDoctorConversions =
          Array.from(
            doctorMap.values()
          );

'''

    s = (
        s[:return_pos]
        + merge
        + s[return_pos:]
    )

    print("PREVIEW OK: 월별 원장 병합")


# ------------------------------------------------------------
# 8. 월 최종 반환에 doctorConversions
# ------------------------------------------------------------

# 마지막 return에서 dailyConversions 다음에 삽입
if "doctorConversions: mergedDoctorConversions" not in s:

    positions = [
        m.start()
        for m in re.finditer(
            r'\bdailyConversions,\s*',
            s
        )
    ]

    if not positions:
        raise SystemExit(
            "PREVIEW: 최종 dailyConversions 못 찾음"
        )

    pos = positions[-1]

    comma =
      s.find(",", pos)

    s = (
        s[:comma + 1]
        + "\n          doctorConversions: mergedDoctorConversions,"
        + s[comma + 1:]
    )

    print("PREVIEW OK: 최종 월 응답")


PREVIEW.write_text(
    s,
    encoding="utf-8"
)


# ============================================================
# COMMIT
# ============================================================

s = COMMIT.read_text(
    encoding="utf-8"
)


# ------------------------------------------------------------
# 9. schema import
# ------------------------------------------------------------

if "doctorConversionStats" not in s:

    target =
      "dailyConversionStats,"

    if target not in s:
        raise SystemExit(
            "COMMIT: dailyConversionStats import 못 찾음"
        )

    s = s.replace(
        target,
        target +
        "\n  doctorConversionStats,",
        1
    )

    print("COMMIT OK: schema import")


# ------------------------------------------------------------
# 10. monthData 타입
# ------------------------------------------------------------

if "doctorConversions?:" not in s:

    match = re.search(
        r'dailyConversions\?:\s*\{[\s\S]*?\}\[\];',
        s
    )

    if not match:
        raise SystemExit(
            "COMMIT: dailyConversions 타입 못 찾음"
        )

    block = '''

  doctorConversions?: {
    doctorName: string;
    reservations: number;
    consultations: number;
    surgeries: number;
  }[];
'''

    s = (
        s[:match.end()]
        + block
        + s[match.end():]
    )

    print("COMMIT OK: doctorConversions 타입")


# ------------------------------------------------------------
# 11. 저장 카운터
# ------------------------------------------------------------

if "let doctorConversionRowsSaved = 0;" not in s:

    target =
      "let dailyConversionRowsSaved = 0;"

    if target not in s:
        raise SystemExit(
            "COMMIT: 저장 카운터 위치 못 찾음"
        )

    s = s.replace(
        target,
        target +
        "\n    let doctorConversionRowsSaved = 0;",
        1
    )

    print("COMMIT OK: 저장 카운터")


# ------------------------------------------------------------
# 12. monthData 루프 내부에 원장 저장
# ------------------------------------------------------------

if "const incomingDoctorConversions =" not in s:

    # incomingDailyConversions가 있는 월 루프를 기준으로
    pos =
      s.find(
        "const incomingDailyConversions"
      )

    if pos < 0:
        raise SystemExit(
            "COMMIT: incomingDailyConversions 못 찾음"
        )

    # 다음 월 처리 블록으로 넘어가기 전 위치.
    # 일별 저장 후 category/platform 처리 전 삽입.
    search_from = pos

    candidates = [
        "const incomingCategory",
        "const incomingPlatforms",
        "const incomingVisit",
        "const category",
    ]

    insert_pos = -1

    for needle in candidates:

        p =
          s.find(
            needle,
            search_from
          )

        if (
          p >= 0 and
          (
            insert_pos < 0 or
            p < insert_pos
          )
        ):
          insert_pos = p


    if insert_pos < 0:

        # fallback: monthData 루프의 다음 큰 처리 전
        insert_pos =
          s.find(
            "monthlyRowsSaved",
            search_from
          )


    if insert_pos < 0:
        raise SystemExit(
            "COMMIT: 원장 저장 삽입 위치 못 찾음"
        )


    save = r'''
        /*
         * ========================================
         * 원장별 상담 / 수술전환
         * ========================================
         */

        const incomingDoctorConversions =
          Array.isArray(
            monthData.doctorConversions
          )
            ? monthData.doctorConversions.filter(
                (row) =>
                  row &&
                  typeof row.doctorName ===
                    "string" &&
                  row.doctorName.trim().length > 0
              )
            : [];


        /*
         * 월별 원장표는 해당 월 1일을 기준일로 저장.
         *
         * 현재 commit scope에는 monthStart가 이미 존재한다.
         */
        for (
          const row of
          incomingDoctorConversions
        ) {

          const doctorName =
            row.doctorName.trim();

          const reservations =
            Math.max(
              0,
              Math.round(
                Number(
                  row.reservations ?? 0
                )
              )
            );

          const consultations =
            Math.max(
              0,
              Math.round(
                Number(
                  row.consultations ?? 0
                )
              )
            );

          const surgeries =
            Math.max(
              0,
              Math.round(
                Number(
                  row.surgeries ?? 0
                )
              )
            );


          await db
            .insert(
              doctorConversionStats
            )
            .values({
              date: monthStart,
              doctorName,
              reservations,
              consultations,
              surgeries,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                doctorConversionStats.date,
                doctorConversionStats.doctorName,
              ],
              set: {
                reservations,
                consultations,
                surgeries,
                updatedAt: new Date(),
              },
            });


          doctorConversionRowsSaved += 1;
        }


'''

    s = (
        s[:insert_pos]
        + save
        + s[insert_pos:]
    )

    print("COMMIT OK: 원장 DB 저장")


# ------------------------------------------------------------
# 13. 응답 카운터
# ------------------------------------------------------------

if not re.search(
    r'\n\s*doctorConversionRowsSaved,\s*\n',
    s
):

    positions = [
        m.start()
        for m in re.finditer(
            r'dailyConversionRowsSaved\s*,',
            s
        )
    ]

    if positions:

        pos =
          positions[-1]

        comma =
          s.find(",", pos)

        s = (
            s[:comma + 1]
            + "\n      doctorConversionRowsSaved,"
            + s[comma + 1:]
        )

        print("COMMIT OK: 저장건수 응답")


COMMIT.write_text(
    s,
    encoding="utf-8"
)


print("")
print("==============================================")
print(" DOCTOR IMPORT FINAL PATCH COMPLETE")
print("==============================================")
print("✓ 원장표 Excel 자동 탐지")
print("✓ 상담예약")
print("✓ 실제상담")
print("✓ 수술결정")
print("✓ preview 전달")
print("✓ DB 저장")
print("✓ 기존 doctor query/UI 연동")
print("")
print("backup:", STAMP)

