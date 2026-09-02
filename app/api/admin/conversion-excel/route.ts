import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import {
  dailyConversionStats,
  doctorConversionStats,
} from "@/lib/db/schema";

type DailyRow = {
  date: string;
  consultations: number;
  surgeries: number;
};

type DoctorRow = {
  date: string;
  doctorName: string;
  reservations: number;
  consultations: number;
  surgeries: number;
};

function n(value: unknown): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const num = Number(value);

  return Number.isFinite(num) ? Math.round(num) : 0;
}

function parseMonth(
  sheetName: string
): {
  year: number;
  month: number;
  monthKey: string;
} | null {
  const match = sheetName.match(
    /(\d{2,4})년\s*(\d{1,2})월/
  );

  if (!match) {
    return null;
  }

  let year = Number(match[1]);

  if (year < 100) {
    year += 2000;
  }

  const month = Number(match[2]);

  if (
    year < 2000 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return {
    year,
    month,
    monthKey:
      `${year}-${String(month).padStart(2, "0")}`,
  };
}

function excelDateToISO(
  value: unknown,
  fallbackYear: number,
  fallbackMonth: number
): string | null {
  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return [
        parsed.y,
        String(parsed.m).padStart(2, "0"),
        String(parsed.d).padStart(2, "0"),
      ].join("-");
    }

    if (value >= 1 && value <= 31) {
      return [
        fallbackYear,
        String(fallbackMonth).padStart(2, "0"),
        String(value).padStart(2, "0"),
      ].join("-");
    }
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  let match = text.match(
    /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
  );

  if (match) {
    return [
      match[1],
      String(Number(match[2])).padStart(2, "0"),
      String(Number(match[3])).padStart(2, "0"),
    ].join("-");
  }

  match = text.match(
    /^(\d{1,2})[-./](\d{1,2})/
  );

  if (match) {
    return [
      fallbackYear,
      String(Number(match[1])).padStart(2, "0"),
      String(Number(match[2])).padStart(2, "0"),
    ].join("-");
  }

  return null;
}

function parseSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet
) {
  const monthInfo = parseMonth(sheetName);

  if (!monthInfo) {
    return null;
  }

  /*
   * header: row 5
   *
   * Y  = 25 = 일자
   * Z  = 26 = 수술 수
   * AA = 27 = 상담
   * AB = 28 = 수술 전환
   *
   * AE = 31 = 원장님
   * AF = 32 = 상담예약(DB포함)
   * AG = 33 = 실상담
   * AH = 34 = 수술결정
   */

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(
    sheet,
    {
      header: 1,
      raw: true,
      defval: null,
    }
  );

  const daily: DailyRow[] = [];
  const doctors: DoctorRow[] = [];

  // Excel row 6부터 실제 데이터
  for (let i = 5; i < matrix.length; i++) {
    const row = matrix[i] ?? [];

    // ------------------------------------------
    // 일별 상담 / 수술결정
    // ------------------------------------------

    const date = excelDateToISO(
      row[24],
      monthInfo.year,
      monthInfo.month
    );

    if (
      date &&
      date.startsWith(monthInfo.monthKey)
    ) {
      const consultations = n(row[26]);
      const surgeries = n(row[27]);

      // 날짜가 있으면 0건이어도 저장.
      // 그래야 월 전체 일별 데이터가 정확히 유지됨.
      daily.push({
        date,
        consultations,
        surgeries,
      });
    }

    // ------------------------------------------
    // 원장별 월 집계
    // ------------------------------------------

    const doctorName = String(
      row[30] ?? ""
    ).trim();

    if (
      doctorName &&
      doctorName !== "원장님"
    ) {
      const reservations = n(row[31]);
      const consultations = n(row[32]);
      const surgeries = n(row[33]);

      /*
       * 원장 데이터는 월 집계이므로
       * 해당 월 1일을 key date로 사용.
       */
      doctors.push({
        date: `${monthInfo.monthKey}-01`,
        doctorName,
        reservations,
        consultations,
        surgeries,
      });
    }
  }

  /*
   * 같은 날짜가 중복될 경우 마지막 값을 사용.
   */
  const dailyMap = new Map<
    string,
    DailyRow
  >();

  for (const row of daily) {
    dailyMap.set(row.date, row);
  }

  /*
   * 같은 월 + 원장 중복도 마지막 값을 사용.
   */
  const doctorMap = new Map<
    string,
    DoctorRow
  >();

  for (const row of doctors) {
    doctorMap.set(
      `${row.date}::${row.doctorName}`,
      row
    );
  }

  return {
    month: monthInfo.monthKey,
    daily: [...dailyMap.values()],
    doctors: [...doctorMap.values()],
  };
}

export async function POST(
  request: Request
) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "엑셀 파일이 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const workbook = XLSX.read(
      buffer,
      {
        type: "buffer",
        cellDates: true,
      }
    );

    const parsedMonths: {
      month: string;
      daily: DailyRow[];
      doctors: DoctorRow[];
    }[] = [];

    for (
      const sheetName of workbook.SheetNames
    ) {
      if (
        sheetName.trim().toUpperCase() ===
        "__TG_RAW"
      ) {
        continue;
      }

      const sheet =
        workbook.Sheets[sheetName];

      if (!sheet) {
        continue;
      }

      const parsed = parseSheet(
        sheetName,
        sheet
      );

      if (!parsed) {
        continue;
      }

      parsedMonths.push(parsed);
    }

    if (parsedMonths.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "처리 가능한 월별 시트를 찾지 못했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    let dailySaved = 0;
    let doctorsSaved = 0;

    const monthResults: {
      month: string;
      daily: number;
      doctors: number;
    }[] = [];

    /*
     * 기존 schema에서 이미 사용 중인
     * onConflictDoUpdate 패턴 그대로 사용.
     */

    for (const month of parsedMonths) {
      for (const row of month.daily) {
        await db
          .insert(dailyConversionStats)
          .values({
            date: row.date,
            consultations:
              row.consultations,
            surgeries:
              row.surgeries,
          })
          .onConflictDoUpdate({
            target:
              dailyConversionStats.date,
            set: {
              consultations:
                row.consultations,
              surgeries:
                row.surgeries,
            },
          });

        dailySaved++;
      }

      for (const row of month.doctors) {
        await db
          .insert(doctorConversionStats)
          .values({
            date: row.date,
            doctorName:
              row.doctorName,
            reservations:
              row.reservations,
            consultations:
              row.consultations,
            surgeries:
              row.surgeries,
          })
          .onConflictDoUpdate({
            target: [
              doctorConversionStats.date,
              doctorConversionStats.doctorName,
            ],
            set: {
              reservations:
                row.reservations,
              consultations:
                row.consultations,
              surgeries:
                row.surgeries,
            },
          });

        doctorsSaved++;
      }

      monthResults.push({
        month: month.month,
        daily:
          month.daily.length,
        doctors:
          month.doctors.length,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        "상담/수술 및 원장별 데이터 업로드 완료",
      sheets:
        parsedMonths.length,
      dailySaved,
      doctorsSaved,
      months:
        monthResults,
    });
  } catch (error) {
    console.error(
      "[conversion-excel]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "엑셀 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
