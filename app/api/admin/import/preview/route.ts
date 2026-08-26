import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { isAdminAuthenticated } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlatformRow = {
  platform: string;
  applications: number;
  reservations: number;
};

type DailyPlatformRow = {
  date: string;
  platform: string;
  applications: number;
  reservations: number;
};

type MonthPreview = {
  month: string;
  platforms: PlatformRow[];
  dailyPlatforms: DailyPlatformRow[];

  consultations: number | null;
  surgeries: number | null;

  sources: string[];
  warnings: string[];
};

function normalizePlatformName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function parseMonthFromSheetName(sheetName: string) {
  const match = sheetName.match(
    /(\d{2,4})\D+(\d{1,2})/
  );

  if (!match) return null;

  let year = Number(match[1]);
  const month = Number(match[2]);

  if (year < 100) {
    year += 2000;
  }

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(
    2,
    "0"
  )}-01`;
}

function toDateString(
  value: unknown,
  fallbackMonth: string
) {
  const [fallbackYear, fallbackMonthNumber] =
    fallbackMonth.split("-").map(Number);

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return `${value.getFullYear()}-${String(
      value.getMonth() + 1
    ).padStart(2, "0")}-${String(
      value.getDate()
    ).padStart(2, "0")}`;
  }

  if (typeof value === "number") {
    const parsed =
      XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return `${parsed.y}-${String(
        parsed.m
      ).padStart(2, "0")}-${String(
        parsed.d
      ).padStart(2, "0")}`;
    }
  }

  const text = String(value ?? "").trim();

  let match = text.match(
    /(\d{4})[./-](\d{1,2})[./-](\d{1,2})/
  );

  if (match) {
    return `${match[1]}-${String(
      Number(match[2])
    ).padStart(2, "0")}-${String(
      Number(match[3])
    ).padStart(2, "0")}`;
  }

  match = text.match(
    /(\d{1,2})[./-](\d{1,2})/
  );

  if (match) {
    return `${fallbackYear}-${String(
      Number(match[1])
    ).padStart(2, "0")}-${String(
      Number(match[2])
    ).padStart(2, "0")}`;
  }

  if (/^\d{1,2}$/.test(text)) {
    return `${fallbackYear}-${String(
      fallbackMonthNumber
    ).padStart(2, "0")}-${String(
      Number(text)
    ).padStart(2, "0")}`;
  }

  return null;
}

function numberValue(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const result = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim()
  );

  return Number.isFinite(result)
    ? result
    : 0;
}

function worksheetToRows(
  worksheet: XLSX.WorkSheet
): unknown[][] {
  return XLSX.utils.sheet_to_json(
    worksheet,
    {
      header: 1,
      raw: true,
      defval: null,
    }
  ) as unknown[][];
}

function parsePlatformWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string
) {
  const result =
    new Map<string, MonthPreview>();

  for (const sheetName of workbook.SheetNames) {
    /*
      예약 변환율 시트를 우선 대상으로 한다.
      기존 파일명 변형도 허용하기 위해
      예약 + 변환율 포함 여부로 판단.
    */
    const normalizedSheetName =
      sheetName.replace(/\s+/g, "");

    if (
      !normalizedSheetName.includes("예약") ||
      !normalizedSheetName.includes("변환율")
    ) {
      continue;
    }

    const month =
      parseMonthFromSheetName(sheetName);

    if (!month) continue;

    const worksheet =
      workbook.Sheets[sheetName];

    const rows =
      worksheetToRows(worksheet);

    const warnings: string[] = [];

    let platformHeaderIndex = -1;
    let subHeaderIndex = -1;

    for (
      let rowIndex = 0;
      rowIndex < Math.min(rows.length, 20);
      rowIndex++
    ) {
      const row =
        rows[rowIndex] ?? [];

      const text = row
        .map((cell) =>
          String(cell ?? "").trim()
        )
        .join("|");

      if (
        text.includes("바비톡") &&
        text.includes("네이버")
      ) {
        platformHeaderIndex =
          rowIndex;
      }

      const applicationCount =
        row.filter(
          (cell) =>
            String(cell ?? "").trim() ===
            "신청"
        ).length;

      const reservationCount =
        row.filter(
          (cell) =>
            String(cell ?? "").trim() ===
            "예약"
        ).length;

      if (
        applicationCount >= 3 &&
        reservationCount >= 3
      ) {
        subHeaderIndex =
          rowIndex;
      }
    }

    if (
      platformHeaderIndex < 0 ||
      subHeaderIndex < 0
    ) {
      warnings.push(
        "플랫폼 헤더 구조를 자동 인식하지 못했습니다."
      );

      continue;
    }

    const platformHeader =
      rows[platformHeaderIndex] ?? [];

    const subHeader =
      rows[subHeaderIndex] ?? [];

    const platformColumns: {
      platform: string;
      applicationColumn: number;
      reservationColumn: number;
    }[] = [];

    const ignoredNames = new Set([
      "CPA 광고",
      "일일 합계",
      "예약취소",
      "일자",
    ]);

    for (
      let column = 0;
      column < platformHeader.length;
      column++
    ) {
      const rawName = String(
        platformHeader[column] ?? ""
      ).trim();

      if (
        !rawName ||
        ignoredNames.has(rawName)
      ) {
        continue;
      }

      const firstSub = String(
        subHeader[column] ?? ""
      ).trim();

      const secondSub = String(
        subHeader[column + 1] ?? ""
      ).trim();

      if (
        firstSub !== "신청" ||
        secondSub !== "예약"
      ) {
        continue;
      }

      platformColumns.push({
        platform:
          normalizePlatformName(rawName),

        applicationColumn:
          column,

        reservationColumn:
          column + 1,
      });
    }

    const totalRowIndex =
      rows.findIndex((row) =>
        row.some(
          (cell) =>
            String(cell ?? "").trim() ===
            "합계"
        )
      );

    const platforms: PlatformRow[] =
      [];

    if (totalRowIndex >= 0) {
      const totalRow =
        rows[totalRowIndex] ?? [];

      for (
        const column of platformColumns
      ) {
        platforms.push({
          platform:
            column.platform,

          applications: Math.max(
            0,
            Math.round(
              numberValue(
                totalRow[
                  column.applicationColumn
                ]
              )
            )
          ),

          reservations: Math.max(
            0,
            Math.round(
              numberValue(
                totalRow[
                  column.reservationColumn
                ]
              )
            )
          ),
        });
      }
    } else {
      warnings.push(
        "합계 행을 찾지 못했습니다."
      );
    }

    /*
      일별 데이터

      신청/예약 하위 헤더 다음 행부터
      합계 직전까지 읽는다.
    */
    const dailyPlatforms:
      DailyPlatformRow[] = [];

    const dailyStart =
      subHeaderIndex + 1;

    const dailyEnd =
      totalRowIndex >= 0
        ? totalRowIndex
        : rows.length;

    for (
      let rowIndex = dailyStart;
      rowIndex < dailyEnd;
      rowIndex++
    ) {
      const row =
        rows[rowIndex] ?? [];

      const dateValue =
        row[0];

      const date =
        toDateString(
          dateValue,
          month
        );

      if (!date) continue;

      for (
        const column of platformColumns
      ) {
        const applications =
          Math.max(
            0,
            Math.round(
              numberValue(
                row[
                  column.applicationColumn
                ]
              )
            )
          );

        const reservations =
          Math.max(
            0,
            Math.round(
              numberValue(
                row[
                  column.reservationColumn
                ]
              )
            )
          );

        dailyPlatforms.push({
          date,
          platform:
            column.platform,
          applications,
          reservations,
        });
      }
    }

    result.set(month, {
      month,
      platforms,
      dailyPlatforms,

      consultations: null,
      surgeries: null,

      sources: [fileName],
      warnings,
    });
  }

  return result;
}

function parseConversionWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string
) {
  const result =
    new Map<
      string,
      {
        consultations: number;
        surgeries: number;
        source: string;
        warnings: string[];
      }
    >();

  for (
    const sheetName of workbook.SheetNames
  ) {
    const month =
      parseMonthFromSheetName(sheetName);

    if (!month) continue;

    const rows =
      worksheetToRows(
        workbook.Sheets[sheetName]
      );

    let consultations:
      number | null = null;

    let surgeries:
      number | null = null;

    const warnings: string[] = [];

    for (
      let rowIndex = 0;
      rowIndex < rows.length - 1;
      rowIndex++
    ) {
      const row =
        rows[rowIndex] ?? [];

      const nextRow =
        rows[rowIndex + 1] ?? [];

      for (
        let column = 0;
        column < row.length;
        column++
      ) {
        const cell = String(
          row[column] ?? ""
        ).trim();

        if (
          cell === "당월 상담"
        ) {
          consultations =
            Math.max(
              0,
              Math.round(
                numberValue(
                  nextRow[column]
                )
              )
            );
        }

        if (
          cell === "당월 수술 전환"
        ) {
          surgeries =
            Math.max(
              0,
              Math.round(
                numberValue(
                  nextRow[column]
                )
              )
            );
        }
      }
    }

    if (
      consultations === null &&
      surgeries === null
    ) {
      continue;
    }

    result.set(month, {
      consultations:
        consultations ?? 0,

      surgeries:
        surgeries ?? 0,

      source:
        fileName,

      warnings,
    });
  }

  return result;
}

export async function POST(
  request: NextRequest
) {
  /*
    관리자 인증
  */
  if (
    !(await isAdminAuthenticated())
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "관리자 로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const formData =
      await request.formData();

    const files =
      formData.getAll("files");

    if (files.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "엑셀 파일을 선택해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const months =
      new Map<
        string,
        MonthPreview
      >();

    for (const item of files) {
      if (!(item instanceof File)) {
        continue;
      }

      const buffer =
        Buffer.from(
          await item.arrayBuffer()
        );

      const workbook =
        XLSX.read(buffer, {
          type: "buffer",
          cellDates: true,
          cellFormula: false,
        });

      const platformResults =
        parsePlatformWorkbook(
          workbook,
          item.name
        );

      const conversionResults =
        parseConversionWorkbook(
          workbook,
          item.name
        );

      for (
        const [
          month,
          platformData,
        ] of platformResults
      ) {
        const existing =
          months.get(month);

        if (!existing) {
          months.set(
            month,
            platformData
          );
        } else {
          if (
            existing.platforms
              .length === 0
          ) {
            existing.platforms =
              platformData.platforms;
          }

          if (
            existing.dailyPlatforms
              .length === 0
          ) {
            existing.dailyPlatforms =
              platformData.dailyPlatforms;
          }

          existing.sources =
            Array.from(
              new Set([
                ...existing.sources,
                ...platformData.sources,
              ])
            );

          existing.warnings.push(
            ...platformData.warnings
          );
        }
      }

      for (
        const [
          month,
          conversion,
        ] of conversionResults
      ) {
        const existing =
          months.get(month);

        if (!existing) {
          months.set(month, {
            month,

            platforms: [],
            dailyPlatforms: [],

            consultations:
              conversion.consultations,

            surgeries:
              conversion.surgeries,

            sources: [
              conversion.source,
            ],

            warnings:
              conversion.warnings,
          });
        } else {
          existing.consultations =
            conversion.consultations;

          existing.surgeries =
            conversion.surgeries;

          existing.sources =
            Array.from(
              new Set([
                ...existing.sources,
                conversion.source,
              ])
            );
        }
      }
    }

    const preview =
      Array.from(
        months.values()
      )
        .map((item) => {
          const totalApplications =
            item.platforms.reduce(
              (sum, row) =>
                sum +
                row.applications,
              0
            );

          const totalReservations =
            item.platforms.reduce(
              (sum, row) =>
                sum +
                row.reservations,
              0
            );

          return {
            ...item,

            totalApplications,
            totalReservations,

            reservationRate:
              totalApplications > 0
                ? (
                    totalReservations /
                    totalApplications
                  ) * 100
                : 0,

            surgeryRate:
              item.consultations !==
                null &&
              item.consultations > 0 &&
              item.surgeries !== null
                ? (
                    item.surgeries /
                    item.consultations
                  ) * 100
                : null,

            dailyRowCount:
              item.dailyPlatforms
                .length,
          };
        })
        .sort((a, b) =>
          b.month.localeCompare(
            a.month
          )
        );

    return NextResponse.json({
      ok: true,
      months: preview,
    });
  } catch (error) {
    console.error(
      "Excel preview error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "엑셀 분석 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}