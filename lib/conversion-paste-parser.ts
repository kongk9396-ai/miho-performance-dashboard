/*
  구글 시트 "상담 대비 수술 전환율" 붙여넣기 파서

  - 일별 표: 일자 | 수술 수 | 상담 | 수술 전환 | (전환율)
  - 원장별 표: 원장님 | 상담예약(DB포함) | 실상담 | 수술결정 | (전환율들)

  두 표를 따로 복사해도 되고, 나란히 놓인 채로 한 번에 복사해도 된다.
  전환율(%) 칸은 무시하고 저장 시 다시 계산한다.
*/

export type ConversionDay = {
  date: string;
  actualSurgeries: number;
  consultations: number;
  surgeries: number;
};

export type DoctorRow = {
  doctorName: string;
  reservations: number;
  consultations: number;
  surgeries: number;
};

export type ConversionParseResult = {
  days: ConversionDay[];
  doctors: DoctorRow[];
  skippedDates: string[];
  detectedMonth: string | null;
};

const HEADER_WORDS = [
  "일자",
  "날짜",
  "수술",
  "상담",
  "전환",
  "원장",
  "합계",
  "소계",
  "평균",
  "예약",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function makeDate(
  year: number,
  month: number,
  day: number
) {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseSheetDate(
  cell: string,
  year: number
) {
  const text = cell.trim();

  let match = text.match(
    /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?\.?$/
  );

  if (match) {
    return makeDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  match = text.match(
    /^(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/
  );

  if (match) {
    return makeDate(
      year,
      Number(match[1]),
      Number(match[2])
    );
  }

  return null;
}

function toInt(cell: string | undefined) {
  const value = String(cell ?? "")
    .replace(/[,\s]/g, "");

  if (!/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function isBlank(cell: string | undefined) {
  return String(cell ?? "").trim() === "";
}

function isDoctorName(cell: string) {
  const text = cell.trim();

  if (!text || text.length > 10) {
    return false;
  }

  if (/\d/.test(text) || text.includes("%")) {
    return false;
  }

  return !HEADER_WORDS.some((word) =>
    text.includes(word)
  );
}

export function parseConversionSheet(
  text: string,
  year: number
): ConversionParseResult {
  const dayMap =
    new Map<string, ConversionDay>();

  const doctorMap =
    new Map<string, DoctorRow>();

  const skipped = new Set<string>();

  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n");

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const cells = line.split("\t");

    let index = 0;

    while (index < cells.length) {
      const cell = cells[index] ?? "";

      /*
        일별 행
      */
      const date = parseSheetDate(
        cell,
        year
      );

      if (date) {
        const values = [
          cells[index + 1],
          cells[index + 2],
          cells[index + 3],
        ];

        if (values.every(isBlank)) {
          skipped.add(date);
          index += 4;
          continue;
        }

        const numbers = values.map((value) =>
          isBlank(value) ? 0 : toInt(value)
        );

        if (
          numbers.every(
            (value) => value !== null
          )
        ) {
          dayMap.set(date, {
            date,
            actualSurgeries: numbers[0]!,
            consultations: numbers[1]!,
            surgeries: numbers[2]!,
          });

          skipped.delete(date);
          index += 4;
          continue;
        }

        index += 1;
        continue;
      }

      /*
        원장별 행
      */
      if (isDoctorName(cell)) {
        const numbers = [
          toInt(cells[index + 1]),
          toInt(cells[index + 2]),
          toInt(cells[index + 3]),
        ];

        if (
          numbers.every(
            (value) => value !== null
          )
        ) {
          const doctorName = cell.trim();

          doctorMap.set(doctorName, {
            doctorName,
            reservations: numbers[0]!,
            consultations: numbers[1]!,
            surgeries: numbers[2]!,
          });

          index += 4;
          continue;
        }
      }

      index += 1;
    }
  }

  const days = Array.from(
    dayMap.values()
  ).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const monthCount =
    new Map<string, number>();

  for (const day of days) {
    const month = day.date.slice(0, 7);

    monthCount.set(
      month,
      (monthCount.get(month) ?? 0) + 1
    );
  }

  const detectedMonth =
    Array.from(monthCount.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? null;

  return {
    days,
    doctors: Array.from(
      doctorMap.values()
    ),
    skippedDates: Array.from(skipped)
      .filter((date) => !dayMap.has(date))
      .sort(),
    detectedMonth,
  };
}