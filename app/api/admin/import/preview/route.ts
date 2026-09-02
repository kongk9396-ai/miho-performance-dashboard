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

type DailyConversionRow = {
  date: string;
  consultations: number;
  surgeries: number;
};

type MonthPreview = {
  month: string;
  platforms: PlatformRow[];
  dailyPlatforms: DailyPlatformRow[];
  dailyConversions: DailyConversionRow[];
  consultations: number | null;
  surgeries: number | null;
  sources: string[];
  warnings: string[];
};

type SheetCandidate = {
  month: string;
  monthlyPlatforms: PlatformRow[];
  monthlyPlatformScore: number;
  dailyPlatforms: DailyPlatformRow[];
  dailyConversions: DailyConversionRow[];
  consultations: number | null;
  surgeries: number | null;
  conversionScore: number;
  warnings: string[];
};

type MonthAccumulator = {
  month: string;
  platformMap: Map<string, PlatformRow>;
  platformScore: number;
  dailyMap: Map<string, DailyPlatformRow>;
  dailyConversionMap: Map<string, DailyConversionRow>;
  consultations: number | null;
  surgeries: number | null;
  conversionScore: number;
  sources: Set<string>;
  warnings: Set<string>;
};

function compactText(value: unknown) {
  return String(value ?? "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[·ㆍ]/g, "");
}

function displayText(value: unknown) {
  return String(value ?? "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePlatformName(value: unknown) {
  const raw = displayText(value);
  const compact = compactText(value).toLowerCase();

  if (!compact) return "";

  const aliases: Record<string, string> = {
    바비톡: "바비톡",
    강남언니: "강남언니",
    네이버: "네이버",
    플러스친구: "플러스친구",
    카카오플러스친구: "플러스친구",
    카카오친구: "플러스친구",
    플친: "플러스친구",
    홈페이지: "홈페이지",
    인콜: "인콜",
    총인콜: "인콜",
    cpa: "CPA",
    cpa광고: "CPA 광고",
  };

  return aliases[compact] ?? raw.replace(/\s+/g, "");
}

function isIgnoredPlatformName(value: unknown) {
  const compact = compactText(value).toLowerCase();
  return new Set([
    "",
    "일자",
    "날짜",
    "요일",
    "예약취소",
    "일일합계",
    "합계",
    "신청",
    "예약",
    "전월신청",
    "당월신청",
    "전월예약",
    "당월예약",
    "cpa광고",
  ]).has(compact);
}

function parseMonthFromSheetName(sheetName: string) {
  const normalized = sheetName.replace(/\s+/g, " ").trim();
  const match = normalized.match(/(\d{2,4})\D+(\d{1,2})/);

  if (!match) return null;

  let year = Number(match[1]);
  const month = Number(match[2]);

  if (year < 100) year += 2000;

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function monthKey(value: string) {
  return String(value).slice(0, 7);
}

function isValidDateParts(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function toDateString(value: unknown, fallbackMonth: string) {
  const [fallbackYear, fallbackMonthNumber] = fallbackMonth
    .slice(0, 7)
    .split("-")
    .map(Number);

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = value.getMonth() + 1;
    const day = value.getDate();

    if (!isValidDateParts(year, month, day)) return null;

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && isValidDateParts(parsed.y, parsed.m, parsed.d)) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
        parsed.d
      ).padStart(2, "0")}`;
    }
  }

  const text = displayText(value);
  if (!text) return null;

  let match = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isValidDateParts(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  match = text.match(/(\d{1,2})[./-](\d{1,2})/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (!isValidDateParts(fallbackYear, month, day)) return null;
    return `${fallbackYear}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
  }

  if (/^\d{1,2}$/.test(text)) {
    const day = Number(text);
    if (!isValidDateParts(fallbackYear, fallbackMonthNumber, day)) return null;
    return `${fallbackYear}-${String(fallbackMonthNumber).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/[▲▼△▽]/g, "")
    .trim();

  const result = Number(cleaned);
  return Number.isFinite(result) ? result : 0;
}

function intValue(value: unknown) {
  return Math.max(0, Math.round(numberValue(value)));
}

function worksheetToRows(worksheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][];
}

function findNearestHeaderValue(
  rows: unknown[][],
  startRow: number,
  column: number,
  lookback = 4
) {
  for (let rowIndex = startRow; rowIndex >= Math.max(0, startRow - lookback); rowIndex--) {
    const value = rows[rowIndex]?.[column];
    if (displayText(value)) return value;
  }
  return null;
}

function findDateColumn(
  rows: unknown[][],
  platformHeaderIndex: number,
  subHeaderIndex: number,
  firstPlatformColumn: number,
  fallbackMonth: string
) {
  for (
    let rowIndex = Math.max(0, platformHeaderIndex - 3);
    rowIndex <= subHeaderIndex;
    rowIndex++
  ) {
    const row = rows[rowIndex] ?? [];
    for (let column = 0; column < row.length; column++) {
      const compact = compactText(row[column]);
      if (compact === "일자" || compact === "날짜") return column;
    }
  }

  let bestColumn = -1;
  let bestCount = 0;
  const maxColumn = Math.max(0, firstPlatformColumn - 1);

  for (let column = 0; column <= maxColumn; column++) {
    let count = 0;
    for (
      let rowIndex = subHeaderIndex + 1;
      rowIndex < Math.min(rows.length, subHeaderIndex + 45);
      rowIndex++
    ) {
      const date = toDateString(rows[rowIndex]?.[column], fallbackMonth);
      if (date && monthKey(date) === monthKey(fallbackMonth)) count++;
    }

    if (count > bestCount) {
      bestCount = count;
      bestColumn = column;
    }
  }

  return bestCount >= 2 ? bestColumn : -1;
}

function parseDailyPlatformLayout(rows: unknown[][], month: string) {
  const warnings: string[] = [];

  let subHeaderIndex = -1;
  let pairColumns: number[] = [];

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 80); rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const pairs: number[] = [];

    for (let column = 0; column < row.length - 1; column++) {
      if (
        compactText(row[column]) === "신청" &&
        compactText(row[column + 1]) === "예약"
      ) {
        pairs.push(column);
      }
    }

    if (pairs.length > pairColumns.length) {
      pairColumns = pairs;
      subHeaderIndex = rowIndex;
    }
  }

  if (subHeaderIndex < 0 || pairColumns.length < 2) {
    return {
      platforms: [] as PlatformRow[],
      dailyPlatforms: [] as DailyPlatformRow[],
      score: 0,
      warnings,
    };
  }

  let platformHeaderIndex = subHeaderIndex - 1;
  let bestHeaderScore = -1;

  for (
    let rowIndex = Math.max(0, subHeaderIndex - 4);
    rowIndex < subHeaderIndex;
    rowIndex++
  ) {
    let score = 0;
    for (const column of pairColumns) {
      const value = rows[rowIndex]?.[column];
      if (displayText(value) && !isIgnoredPlatformName(value)) score++;
    }

    if (score > bestHeaderScore) {
      bestHeaderScore = score;
      platformHeaderIndex = rowIndex;
    }
  }

  const platformColumns: {
    platform: string;
    applicationColumn: number;
    reservationColumn: number;
  }[] = [];

  for (const column of pairColumns) {
    const rawName = findNearestHeaderValue(
      rows,
      platformHeaderIndex,
      column,
      3
    );

    if (!rawName || isIgnoredPlatformName(rawName)) continue;

    const platform = normalizePlatformName(rawName);
    if (!platform || isIgnoredPlatformName(platform)) continue;

    if (
      platformColumns.some(
        (item) => compactText(item.platform) === compactText(platform)
      )
    ) {
      continue;
    }

    platformColumns.push({
      platform,
      applicationColumn: column,
      reservationColumn: column + 1,
    });
  }

  if (platformColumns.length < 2) {
    warnings.push("신청/예약 헤더는 찾았지만 플랫폼 열을 충분히 인식하지 못했습니다.");
    return {
      platforms: [] as PlatformRow[],
      dailyPlatforms: [] as DailyPlatformRow[],
      score: 0,
      warnings,
    };
  }

  const firstPlatformColumn = Math.min(
    ...platformColumns.map((item) => item.applicationColumn)
  );
  const dateColumn = findDateColumn(
    rows,
    platformHeaderIndex,
    subHeaderIndex,
    firstPlatformColumn,
    month
  );

  if (dateColumn < 0) {
    warnings.push("일별 데이터의 날짜 열을 자동 인식하지 못했습니다.");
  }

  let totalRowIndex = -1;
  const searchEnd = Math.min(rows.length, subHeaderIndex + 50);

  for (let rowIndex = subHeaderIndex + 1; rowIndex < searchEnd; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const dateCellText = dateColumn >= 0 ? compactText(row[dateColumn]) : "";
    const hasTotalText = row.some((cell) => compactText(cell) === "합계");

    if (dateCellText === "합계" || hasTotalText) {
      const numericPlatformCells = platformColumns.reduce((count, column) => {
        const a = row[column.applicationColumn];
        const r = row[column.reservationColumn];
        return count + (a !== null && a !== undefined ? 1 : 0) + (r !== null && r !== undefined ? 1 : 0);
      }, 0);

      if (numericPlatformCells >= platformColumns.length) {
        totalRowIndex = rowIndex;
        break;
      }
    }
  }

  const dailyPlatforms: DailyPlatformRow[] = [];
  const dailyEnd = totalRowIndex >= 0 ? totalRowIndex : searchEnd;

  if (dateColumn >= 0) {
    for (let rowIndex = subHeaderIndex + 1; rowIndex < dailyEnd; rowIndex++) {
      const row = rows[rowIndex] ?? [];
      const date = toDateString(row[dateColumn], month);
      if (!date || monthKey(date) !== monthKey(month)) continue;

      for (const column of platformColumns) {
        dailyPlatforms.push({
          date,
          platform: column.platform,
          applications: intValue(row[column.applicationColumn]),
          reservations: intValue(row[column.reservationColumn]),
        });
      }
    }
  }

  let platforms: PlatformRow[] = [];

  if (totalRowIndex >= 0) {
    const totalRow = rows[totalRowIndex] ?? [];
    platforms = platformColumns.map((column) => ({
      platform: column.platform,
      applications: intValue(totalRow[column.applicationColumn]),
      reservations: intValue(totalRow[column.reservationColumn]),
    }));
  } else if (dailyPlatforms.length > 0) {
    const grouped = new Map<string, PlatformRow>();

    for (const row of dailyPlatforms) {
      const key = compactText(row.platform);
      const existing = grouped.get(key);
      if (existing) {
        existing.applications += row.applications;
        existing.reservations += row.reservations;
      } else {
        grouped.set(key, {
          platform: row.platform,
          applications: row.applications,
          reservations: row.reservations,
        });
      }
    }

    platforms = Array.from(grouped.values());
    warnings.push("합계 행이 없어 일별 데이터를 합산해 월 합계를 만들었습니다.");
  }

  const score =
    (totalRowIndex >= 0 ? 1000 : dailyPlatforms.length > 0 ? 800 : 0) +
    platformColumns.length * 10 +
    Math.min(dailyPlatforms.length, 300);

  return {
    platforms,
    dailyPlatforms,
    score,
    warnings,
  };
}

function parseComparisonPlatformLayout(rows: unknown[][]) {
  const platforms = new Map<string, PlatformRow>();

  for (let rowIndex = 1; rowIndex < rows.length - 1; rowIndex++) {
    const headerRow = rows[rowIndex] ?? [];
    const valueRow = rows[rowIndex + 1] ?? [];

    for (let column = 0; column < headerRow.length - 4; column++) {
      const h0 = compactText(headerRow[column]);
      const h1 = compactText(headerRow[column + 1]);
      const h3 = compactText(headerRow[column + 3]);
      const h4 = compactText(headerRow[column + 4]);

      if (
        h0 !== "전월신청" ||
        h1 !== "당월신청" ||
        h3 !== "전월예약" ||
        h4 !== "당월예약"
      ) {
        continue;
      }

      const rawPlatform = findNearestHeaderValue(rows, rowIndex - 1, column, 3);
      if (!rawPlatform || isIgnoredPlatformName(rawPlatform)) continue;

      const platform = normalizePlatformName(rawPlatform);
      if (!platform) continue;

      platforms.set(compactText(platform), {
        platform,
        applications: intValue(valueRow[column + 1]),
        reservations: intValue(valueRow[column + 4]),
      });
    }
  }

  const rowsOut = Array.from(platforms.values());
  return {
    platforms: rowsOut,
    score: rowsOut.length > 0 ? 300 + rowsOut.length * 10 : 0,
  };
}


function parseDailyConversionLayout(
  rows: unknown[][],
  month: string
) {
  const result: DailyConversionRow[] = [];

  let headerRow = -1;
  let dateCol = -1;
  let consultationCol = -1;
  let conversionCol = -1;

  for (let r = 0; r < Math.min(rows.length, 100); r++) {
    const row = rows[r] ?? [];

    let foundDate = -1;
    let foundConsult = -1;
    let foundConversion = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = compactText(row[c]);

      if (
        cell === "일자" ||
        cell === "날짜"
      ) {
        foundDate = c;
      }

      if (
        cell === "상담" ||
        cell === "상담수" ||
        cell === "상담건수" ||
        cell === "실상담"
      ) {
        foundConsult = c;
      }

      if (
        cell === "수술전환" ||
        cell === "수술전환수" ||
        cell === "수술결정" ||
        cell === "수술결정수"
      ) {
        foundConversion = c;
      }
    }

    if (
      foundDate >= 0 &&
      foundConsult >= 0 &&
      foundConversion >= 0
    ) {
      headerRow = r;
      dateCol = foundDate;
      consultationCol = foundConsult;
      conversionCol = foundConversion;
      break;
    }
  }

  if (
    headerRow < 0 ||
    dateCol < 0 ||
    consultationCol < 0 ||
    conversionCol < 0
  ) {
    return {
      rows: result,
      consultations: null as number | null,
      surgeries: null as number | null,
      score: 0,
    };
  }

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];

    const rawDate = row[dateCol];

    if (
      compactText(rawDate) === "합계" ||
      compactText(rawDate) === "총합"
    ) {
      break;
    }

    const date = toDateString(rawDate, month);

    if (!date || monthKey(date) !== monthKey(month)) {
      continue;
    }

    const consultations = intValue(row[consultationCol]);
    const surgeries = intValue(row[conversionCol]);

    if (
      consultations === null &&
      surgeries === null
    ) {
      continue;
    }

    result.push({
      date,
      consultations: consultations ?? 0,
      surgeries: surgeries ?? 0,
    });
  }

  const totalConsultations =
    result.reduce(
      (sum, row) => sum + row.consultations,
      0
    );

  const totalSurgeries =
    result.reduce(
      (sum, row) => sum + row.surgeries,
      0
    );

  return {
    rows: result,
    consultations:
      result.length > 0
        ? totalConsultations
        : null,
    surgeries:
      result.length > 0
        ? totalSurgeries
        : null,
    score:
      result.length > 0
        ? 1200 + result.length
        : 0,
  };
}

function parseMonthlyConversionLayout(rows: unknown[][]) {
  let consultations: number | null = null;
  let surgeries: number | null = null;

  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const nextRow = rows[rowIndex + 1] ?? [];

    for (let column = 0; column < row.length; column++) {
      const cell = compactText(row[column]);

      if (
        cell === "당월상담" ||
        cell === "당월상담수" ||
        cell === "당월상담건수"
      ) {
        consultations = intValue(nextRow[column]);
      }

      if (
        cell === "당월수술전환" ||
        cell === "당월수술" ||
        cell === "당월수술전환수"
      ) {
        surgeries = intValue(nextRow[column]);
      }
    }
  }

  return {
    consultations,
    surgeries,
    score:
      consultations !== null || surgeries !== null
        ? consultations !== null && surgeries !== null
          ? 1000
          : 700
        : 0,
  };
}

function parseSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  fileName: string
): SheetCandidate | null {
  const month = parseMonthFromSheetName(sheetName);
  if (!month) return null;

  const rows = worksheetToRows(worksheet);
  const warnings: string[] = [];

  const dailyLayout = parseDailyPlatformLayout(rows, month);
  warnings.push(...dailyLayout.warnings);

  const comparisonLayout = parseComparisonPlatformLayout(rows);

  let monthlyPlatforms = dailyLayout.platforms;
  let monthlyPlatformScore = dailyLayout.score;

  if (comparisonLayout.score > monthlyPlatformScore) {
    monthlyPlatforms = comparisonLayout.platforms;
    monthlyPlatformScore = comparisonLayout.score;
  } else if (
    comparisonLayout.platforms.length > 0 &&
    comparisonLayout.score <= monthlyPlatformScore
  ) {
    const existing = new Set(
      monthlyPlatforms.map((row) => compactText(row.platform))
    );
    for (const row of comparisonLayout.platforms) {
      if (!existing.has(compactText(row.platform))) monthlyPlatforms.push(row);
    }
  }

  const conversion = parseMonthlyConversionLayout(rows);
  const dailyConversion =
    parseDailyConversionLayout(rows, month);

  if (
    dailyConversion.score > conversion.score
  ) {
    conversion.consultations =
      dailyConversion.consultations;
    conversion.surgeries =
      dailyConversion.surgeries;
    conversion.score =
      dailyConversion.score;
  }

  if (
    monthlyPlatforms.length === 0 &&
    dailyLayout.dailyPlatforms.length === 0 &&
    dailyConversion.rows.length === 0 &&
    conversion.score === 0
  ) {
    return null;
  }

  if (dailyLayout.dailyPlatforms.length === 0 && monthlyPlatforms.length > 0) {
    warnings.push(`${fileName} / ${sheetName}: 월 합계는 인식했지만 일별 원본은 찾지 못했습니다.`);
  }

  return {
    month,
    monthlyPlatforms,
    monthlyPlatformScore,
    dailyPlatforms: dailyLayout.dailyPlatforms,
    dailyConversions: dailyConversion.rows,
    consultations: conversion.consultations,
    surgeries: conversion.surgeries,
    conversionScore: conversion.score,
    warnings,
  };
}

function getAccumulator(
  months: Map<string, MonthAccumulator>,
  month: string
) {
  const existing = months.get(month);
  if (existing) return existing;

  const created: MonthAccumulator = {
    month,
    platformMap: new Map(),
    platformScore: 0,
    dailyMap: new Map(),
    dailyConversionMap: new Map(),
    consultations: null,
    surgeries: null,
    conversionScore: 0,
    sources: new Set(),
    warnings: new Set(),
  };

  months.set(month, created);
  return created;
}

function mergeCandidate(
  accumulator: MonthAccumulator,
  candidate: SheetCandidate,
  sourceName: string
) {
  accumulator.sources.add(sourceName);
  for (const warning of candidate.warnings) accumulator.warnings.add(warning);

  if (candidate.monthlyPlatforms.length > 0) {
    if (candidate.monthlyPlatformScore > accumulator.platformScore) {
      accumulator.platformMap.clear();
      for (const row of candidate.monthlyPlatforms) {
        accumulator.platformMap.set(compactText(row.platform), row);
      }
      accumulator.platformScore = candidate.monthlyPlatformScore;
    } else if (candidate.monthlyPlatformScore === accumulator.platformScore) {
      for (const row of candidate.monthlyPlatforms) {
        accumulator.platformMap.set(compactText(row.platform), row);
      }
    }
  }

  for (const row of candidate.dailyPlatforms) {
    const key = `${row.date}|${compactText(row.platform)}`;
    const existing = accumulator.dailyMap.get(key);

    if (
      existing &&
      (existing.applications !== row.applications ||
        existing.reservations !== row.reservations)
    ) {
      accumulator.warnings.add(
        `${row.date} ${row.platform} 일별 값이 파일마다 달라 더 나중에 읽은 값을 사용했습니다.`
      );
    }

    accumulator.dailyMap.set(key, row);
  }

  for (const row of candidate.dailyConversions ?? []) {
    accumulator.dailyConversionMap.set(
      row.date,
      row
    );
  }

  if (candidate.conversionScore > accumulator.conversionScore) {
    accumulator.consultations = candidate.consultations;
    accumulator.surgeries = candidate.surgeries;
    accumulator.conversionScore = candidate.conversionScore;
  } else if (candidate.conversionScore === accumulator.conversionScore) {
    if (accumulator.consultations === null && candidate.consultations !== null) {
      accumulator.consultations = candidate.consultations;
    }
    if (accumulator.surgeries === null && candidate.surgeries !== null) {
      accumulator.surgeries = candidate.surgeries;
    }
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, message: "관리자 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files");

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, message: "엑셀 파일을 선택해주세요." },
        { status: 400 }
      );
    }

    const months = new Map<string, MonthAccumulator>();

    for (const item of files) {
      if (!(item instanceof File)) continue;

      const buffer = Buffer.from(await item.arrayBuffer());
      const workbook = XLSX.read(buffer, {
        type: "buffer",
        cellDates: true,
        cellFormula: false,
      });

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        const candidate = parseSheet(worksheet, sheetName, item.name);
        if (!candidate) continue;

        const accumulator = getAccumulator(months, candidate.month);
        mergeCandidate(accumulator, candidate, `${item.name} / ${sheetName}`);
      }
    }

    const preview = Array.from(months.values())
      .map((item): MonthPreview & {
        totalApplications: number;
        totalReservations: number;
        reservationRate: number;
        surgeryRate: number | null;
        dailyRowCount: number;
      } => {
        const platforms = Array.from(item.platformMap.values());
        const dailyPlatforms = Array.from(item.dailyMap.values()).sort((a, b) =>
          a.date === b.date
            ? a.platform.localeCompare(b.platform, "ko")
            : a.date.localeCompare(b.date)
        );

        const dailyConversions =
          Array.from(
            item.dailyConversionMap.values()
          ).sort(
            (a, b) =>
              a.date.localeCompare(b.date)
          );

        const totalApplications = platforms.reduce(
          (sum, row) => sum + row.applications,
          0
        );
        const totalReservations = platforms.reduce(
          (sum, row) => sum + row.reservations,
          0
        );

        return {
          month: item.month,
          platforms,
          dailyPlatforms,
          dailyConversions,
          consultations: item.consultations,
          surgeries: item.surgeries,
          sources: Array.from(item.sources),
          warnings: Array.from(item.warnings),
          totalApplications,
          totalReservations,
          reservationRate:
            totalApplications > 0
              ? (totalReservations / totalApplications) * 100
              : 0,
          surgeryRate:
            item.consultations !== null &&
            item.consultations > 0 &&
            item.surgeries !== null
              ? (item.surgeries / item.consultations) * 100
              : null,
          dailyRowCount: dailyPlatforms.length,
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    return NextResponse.json({
      ok: true,
      months: preview,
    });
  } catch (error) {
    console.error("Excel preview error:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? `엑셀 분석 중 오류: ${error.message}`
            : "엑셀 분석 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
