from pathlib import Path
from datetime import datetime
import shutil
import re

ROOT = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard")
STAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

PREVIEW = ROOT / "app/api/admin/import/preview/route.ts"
COMMIT = ROOT / "app/api/admin/import/commit/route.ts"

for p in [PREVIEW, COMMIT]:
    if not p.exists():
        raise SystemExit(f"파일 없음: {p}")
    shutil.copy2(p, Path(str(p) + f".bak_doctor_import_{STAMP}"))

print("BACKUP:", STAMP)

# ============================================================
# PREVIEW
# ============================================================

preview = PREVIEW.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1. Doctor 타입
# ------------------------------------------------------------

if "type DoctorConversionRow =" not in preview:

    marker = "type DailyConversionRow ="

    pos = preview.find(marker)

    if pos < 0:
        raise SystemExit(
            "preview: DailyConversionRow 타입 위치를 못 찾음"
        )

    doctor_type = r'''
type DoctorConversionRow = {
  doctorName: string;
  reservations: number;
  consultations: number;
  surgeries: number;
};

'''

    preview = preview[:pos] + doctor_type + preview[pos:]

    print("PREVIEW: DoctorConversionRow 타입 추가")


# ------------------------------------------------------------
# 2. SheetCandidate / Month 구조에 doctorConversions 추가
# ------------------------------------------------------------

# dailyConversions 필드 바로 다음에 넣는다.
if "doctorConversions: DoctorConversionRow[]" not in preview:

    pattern = re.compile(
        r'(dailyConversions:\s*DailyConversionRow\[\];)'
    )

    preview, count = pattern.subn(
        r'\1\n  doctorConversions: DoctorConversionRow[];',
        preview
    )

    if count == 0:
        raise SystemExit(
            "preview: dailyConversions 타입 필드를 못 찾음"
        )

    print(
        "PREVIEW: doctorConversions 타입 필드 추가",
        count
    )


# ------------------------------------------------------------
# 3. 숫자 변환 helper
# ------------------------------------------------------------

if "function doctorNumber(" not in preview:

    marker = "function parseDailyConversionLayout"

    pos = preview.find(marker)

    if pos < 0:
        raise SystemExit(
            "preview: parseDailyConversionLayout 위치 못 찾음"
        )

    helper = r'''
function doctorNumber(value: unknown): number {
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

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const parsed = Number(normalized);

  return Number.isFinite(parsed)
    ? Math.max(0, Math.round(parsed))
    : 0;
}


/*
 * 원장별 상담 / 수술 전환 표 자동 인식
 *
 * 지원 헤더 예:
 *
 * 원장 | 상담예약 | 실상담 | 수술결정
 * 원장명 | 상담예약(DB포함) | 실제상담 | 수술결정
 * 의사 | 예약상담 | 상담 | 수술결정
 */
function parseDoctorConversionLayout(
  rows: unknown[][]
): DoctorConversionRow[] {

  const result: DoctorConversionRow[] = [];

  const normalize = (value: unknown) =>
    String(value ?? "")
      .replace(/\s+/g, "")
      .replace(/[()]/g, "")
      .toLowerCase();

  let headerRow = -1;

  let doctorCol = -1;
  let reservationCol = -1;
  let consultationCol = -1;
  let surgeryCol = -1;


  /*
   * 헤더 탐색
   */
  for (
    let r = 0;
    r < Math.min(rows.length, 120);
    r++
  ) {

    const row = rows[r] ?? [];

    const normalized =
      row.map(normalize);

    const d =
      normalized.findIndex((v) =>
        v === "원장" ||
        v === "원장명" ||
        v === "의사" ||
        v === "의사명" ||
        v.includes("원장")
      );

    const reservation =
      normalized.findIndex((v) =>
        v.includes("상담예약") ||
        v.includes("예약상담") ||
        v.includes("db포함")
      );

    const consultation =
      normalized.findIndex((v) =>
        v === "실상담" ||
        v === "실제상담" ||
        v.includes("실상담") ||
        v.includes("실제상담")
      );

    const surgery =
      normalized.findIndex((v) =>
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
    return result;
  }


  /*
   * 헤더 아래 행 파싱
   */
  for (
    let r = headerRow + 1;
    r < rows.length;
    r++
  ) {

    const row = rows[r] ?? [];

    const doctorName =
      String(
        row[doctorCol] ?? ""
      ).trim();


    if (!doctorName) {
      /*
       * 표가 끝났다고 판단하기 전에
       * 몇 줄 정도 빈 행이 있을 수 있으므로 skip
       */
      continue;
    }


    const normalizedDoctor =
      normalize(doctorName);


    /*
     * 합계 / 총계 행 제외
     */
    if (
      normalizedDoctor === "합계" ||
      normalizedDoctor === "총계" ||
      normalizedDoctor === "total"
    ) {
      continue;
    }


    /*
     * 다른 섹션 헤더가 시작되면 제외
     */
    if (
      doctorName.startsWith("<") ||
      normalizedDoctor.includes("내원경로") ||
      normalizedDoctor.includes("총인콜")
    ) {
      continue;
    }


    const reservations =
      doctorNumber(
        row[reservationCol]
      );

    const consultations =
      doctorNumber(
        row[consultationCol]
      );

    const surgeries =
      doctorNumber(
        row[surgeryCol]
      );


    /*
     * 숫자가 하나도 없는 행은 데이터 행이 아님
     */
    if (
      reservations === 0 &&
      consultations === 0 &&
      surgeries === 0
    ) {
      continue;
    }


    result.push({
      doctorName,
      reservations,
      consultations,
      surgeries,
    });
  }


  /*
   * 동일 원장 중복행이 있으면 합산
   */
  const merged =
    new Map<
      string,
      DoctorConversionRow
    >();


  for (const row of result) {

    const existing =
      merged.get(row.doctorName);

    if (!existing) {
      merged.set(
        row.doctorName,
        { ...row }
      );
      continue;
    }

    existing.reservations +=
      row.reservations;

    existing.consultations +=
      row.consultations;

    existing.surgeries +=
      row.surgeries;
  }


  return Array.from(
    merged.values()
  );
}


'''

    preview = preview[:pos] + helper + preview[pos:]

    print("PREVIEW: 원장별 Excel parser 추가")


# ------------------------------------------------------------
# 4. parseSheet 결과에 원장 데이터 생성
# ------------------------------------------------------------

if "parseDoctorConversionLayout(rows)" not in preview:

    # 기존 daily conversion 파싱하는 위치를 이용
    pattern = re.compile(
        r'(const\s+dailyConversion\s*=\s*'
        r'parseDailyConversionLayout\([\s\S]*?\);)'
    )

    match = pattern.search(preview)

    if not match:
        raise SystemExit(
            "preview: dailyConversion 파싱 호출 위치를 못 찾음"
        )

    addition = r'''

    const doctorConversions =
      parseDoctorConversionLayout(rows);
'''

    preview = (
        preview[:match.end()]
        + addition
        + preview[match.end():]
    )

    print("PREVIEW: 원장 파서 호출 추가")


# ------------------------------------------------------------
# 5. candidate return에 doctorConversions
# ------------------------------------------------------------

# parseSheet의 dailyConversions: dailyConversion.rows 다음
if "doctorConversions,\n" not in preview:

    target = "dailyConversions: dailyConversion.rows,"

    if target not in preview:
        raise SystemExit(
            "preview: candidate dailyConversions 반환 위치 못 찾음"
        )

    preview = preview.replace(
        target,
        target + "\n    doctorConversions,",
        1
    )

    print("PREVIEW: candidate 응답에 원장 데이터 추가")


# ------------------------------------------------------------
# 6. 월 병합 과정에 원장 데이터 포함
# ------------------------------------------------------------

# const dailyConversions = ... 근처에 doctorConversions 병합 생성
if "const doctorConversions =" not in preview:

    # 뒤쪽 월별 결과 조립 영역의 const dailyConversions 찾기
    matches = list(
        re.finditer(
            r'const\s+dailyConversions\s*=',
            preview
        )
    )

    if not matches:
        raise SystemExit(
            "preview: 월별 dailyConversions 조립 위치 못 찾음"
        )

    m = matches[-1]

    # 해당 statement 끝 ; 찾기
    semi = preview.find(";", m.start())

    if semi < 0:
        raise SystemExit(
            "preview: dailyConversions statement 끝 못 찾음"
        )

    merge_code = r'''

        const doctorMap =
          new Map<
            string,
            DoctorConversionRow
          >();

        for (
          const row of
          candidate.doctorConversions ?? []
        ) {

          const current =
            doctorMap.get(
              row.doctorName
            );

          if (!current) {
            doctorMap.set(
              row.doctorName,
              { ...row }
            );
            continue;
          }

          current.reservations +=
            row.reservations;

          current.consultations +=
            row.consultations;

          current.surgeries +=
            row.surgeries;
        }

        const doctorConversions =
          Array.from(
            doctorMap.values()
          );

'''

    preview = (
        preview[:semi + 1]
        + merge_code
        + preview[semi + 1:]
    )

    print("PREVIEW: 월별 원장 데이터 조립 추가")


# ------------------------------------------------------------
# 7. 최종 month 반환에 doctorConversions 추가
# ------------------------------------------------------------

# dailyConversions, 다음에 추가.
if not re.search(
    r'dailyConversions,\s*\n\s*doctorConversions,',
    preview
):

    # 가장 뒤쪽 dailyConversions, 를 대상으로
    positions = [
        m.start()
        for m in re.finditer(
            r'\bdailyConversions,\s*',
            preview
        )
    ]

    if not positions:
        raise SystemExit(
            "preview: 최종 dailyConversions 반환 못 찾음"
        )

    pos = positions[-1]

    end = preview.find(
        "dailyConversions",
        pos
    ) + len("dailyConversions")

    comma = preview.find(",", end)

    preview = (
        preview[:comma + 1]
        + "\n          doctorConversions,"
        + preview[comma + 1:]
    )

    print("PREVIEW: 최종 월 응답에 doctorConversions 추가")


PREVIEW.write_text(
    preview,
    encoding="utf-8"
)


# ============================================================
# COMMIT
# ============================================================

commit = COMMIT.read_text(encoding="utf-8")


# ------------------------------------------------------------
# 8. schema import
# ------------------------------------------------------------

if "doctorConversionStats" not in commit:

    target = "dailyConversionStats,"

    if target not in commit:
        raise SystemExit(
            "commit: dailyConversionStats import 못 찾음"
        )

    commit = commit.replace(
        target,
        target + "\n  doctorConversionStats,",
        1
    )

    print("COMMIT: doctorConversionStats import 추가")


# ------------------------------------------------------------
# 9. ImportMonth 타입
# ------------------------------------------------------------

if "doctorConversions?:" not in commit:

    # dailyConversions 타입 블록 끝을 찾는다.
    pattern = re.compile(
        r'(dailyConversions\?:\s*\{[\s\S]*?\}\[\];)'
    )

    match = pattern.search(commit)

    if not match:
        raise SystemExit(
            "commit: dailyConversions 타입 블록 못 찾음"
        )

    doctor_field = r'''

  doctorConversions?: {
    doctorName: string;
    reservations: number;
    consultations: number;
    surgeries: number;
  }[];
'''

    commit = (
        commit[:match.end()]
        + doctor_field
        + commit[match.end():]
    )

    print("COMMIT: doctorConversions 타입 추가")


# ------------------------------------------------------------
# 10. 저장 카운터
# ------------------------------------------------------------

if "doctorConversionRowsSaved" not in commit:

    target = "let dailyConversionRowsSaved = 0;"

    if target not in commit:
        raise SystemExit(
            "commit: dailyConversionRowsSaved 위치 못 찾음"
        )

    commit = commit.replace(
        target,
        target +
        "\n    let doctorConversionRowsSaved = 0;",
        1
    )

    print("COMMIT: 원장 저장 카운터 추가")


# ------------------------------------------------------------
# 11. monthData.dailyConversions 저장 뒤 원장 저장
# ------------------------------------------------------------

if "incomingDoctorConversions" not in commit:

    # 기존 incomingDailyConversions 블록을 찾아서
    # 다음 major block 직전에 삽입
    marker = "dailyConversionRowsSaved +="

    pos = commit.find(marker)

    if pos < 0:
        raise SystemExit(
            "commit: 일별 conversion 저장 카운터 위치 못 찾음"
        )

    # 해당 statement의 ; 뒤
    semi = commit.find(";", pos)

    if semi < 0:
        raise SystemExit(
            "commit: 일별 저장 카운터 끝 못 찾음"
        )

    doctor_save = r'''


        /*
         * ========================================
         * 원장별 상담 / 수술 전환 저장
         * ========================================
         */

        const incomingDoctorConversions =
          Array.isArray(
            monthData.doctorConversions
          )
            ? monthData.doctorConversions.filter(
                (row) =>
                  row &&
                  typeof row.doctorName === "string" &&
                  row.doctorName.trim().length > 0
              )
            : [];


        if (
          incomingDoctorConversions.length > 0
        ) {

          /*
           * 월 단위 표이므로 해당 월 1일을
           * 기준 날짜로 저장한다.
           */
          const doctorStatDate =
            `${month}-01`;


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


            await tx
              .insert(
                doctorConversionStats
              )
              .values({
                date: doctorStatDate,
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
        }

'''

    commit = (
        commit[:semi + 1]
        + doctor_save
        + commit[semi + 1:]
    )

    print("COMMIT: 원장별 DB upsert 추가")


# ------------------------------------------------------------
# 12. 응답에 저장건수 추가
# ------------------------------------------------------------

if not re.search(
    r'doctorConversionRowsSaved\s*,',
    commit
):

    # response의 dailyConversionRowsSaved 다음
    positions = [
        m.start()
        for m in re.finditer(
            r'dailyConversionRowsSaved\s*,',
            commit
        )
    ]

    if positions:

        pos = positions[-1]

        comma = commit.find(",", pos)

        commit = (
            commit[:comma + 1]
            + "\n      doctorConversionRowsSaved,"
            + commit[comma + 1:]
        )

        print("COMMIT: 응답에 원장 저장 건수 추가")


COMMIT.write_text(
    commit,
    encoding="utf-8"
)


print("")
print("==============================================")
print(" DOCTOR EXCEL IMPORT PATCH COMPLETE")
print("==============================================")
print("1. 원장별 Excel 표 자동 탐지")
print("2. 상담예약 자동 파싱")
print("3. 실제상담 자동 파싱")
print("4. 수술결정 자동 파싱")
print("5. preview → commit 전달")
print("6. doctor_conversion_stats 자동 upsert")
print("")
print("BACKUP:", STAMP)

