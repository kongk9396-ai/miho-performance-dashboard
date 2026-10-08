from pathlib import Path
from datetime import datetime
import shutil

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_exact_conversion_{stamp}")
shutil.copy2(p, bak)

old = """    dailyConversions: dailyConversion.rows,
    consultations: conversion.consultations,
    surgeries: conversion.surgeries,
    conversionScore: conversion.score,"""

new = """    dailyConversions: (() => {
      // MIHO 예약 변환율 엑셀 고정 영역:
      // Y=일자, AA=상담, AB=수술전환
      const exactRows: DailyConversionRow[] = [];

      const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");

      for (let r = 5; r <= range.e.r; r++) {
        const dateCell = sheet[XLSX.utils.encode_cell({ r, c: 24 })]; // Y
        const consultCell = sheet[XLSX.utils.encode_cell({ r, c: 26 })]; // AA
        const surgeryCell = sheet[XLSX.utils.encode_cell({ r, c: 27 })]; // AB

        if (!dateCell) continue;

        const rawDate = dateCell.v;
        let date: string | null = null;

        if (rawDate instanceof Date) {
          date =
            `${rawDate.getFullYear()}-` +
            `${String(rawDate.getMonth() + 1).padStart(2, "0")}-` +
            `${String(rawDate.getDate()).padStart(2, "0")}`;
        } else if (typeof rawDate === "number") {
          const parsed = XLSX.SSF.parse_date_code(rawDate);

          if (parsed) {
            date =
              `${parsed.y}-` +
              `${String(parsed.m).padStart(2, "0")}-` +
              `${String(parsed.d).padStart(2, "0")}`;
          }
        } else {
          const text = String(rawDate).trim();

          const full = text.match(
            /^(\\d{4})[-./](\\d{1,2})[-./](\\d{1,2})/
          );

          if (full) {
            date =
              `${full[1]}-` +
              `${String(Number(full[2])).padStart(2, "0")}-` +
              `${String(Number(full[3])).padStart(2, "0")}`;
          }
        }

        if (!date || !date.startsWith(month)) continue;

        const consultations =
          Number(consultCell?.v ?? 0) || 0;

        const surgeries =
          Number(surgeryCell?.v ?? 0) || 0;

        exactRows.push({
          date,
          consultations,
          surgeries,
        });
      }

      return exactRows.length > 0
        ? exactRows
        : dailyConversion.rows;
    })(),

    consultations: (() => {
      const exactRows: DailyConversionRow[] = [];
      const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");

      for (let r = 5; r <= range.e.r; r++) {
        const dateCell = sheet[XLSX.utils.encode_cell({ r, c: 24 })];
        const consultCell = sheet[XLSX.utils.encode_cell({ r, c: 26 })];

        if (!dateCell) continue;

        const rawDate = dateCell.v;
        let y = 0;
        let m = 0;

        if (rawDate instanceof Date) {
          y = rawDate.getFullYear();
          m = rawDate.getMonth() + 1;
        } else if (typeof rawDate === "number") {
          const parsed = XLSX.SSF.parse_date_code(rawDate);
          if (parsed) {
            y = parsed.y;
            m = parsed.m;
          }
        } else {
          const match = String(rawDate).match(
            /^(\\d{4})[-./](\\d{1,2})/
          );
          if (match) {
            y = Number(match[1]);
            m = Number(match[2]);
          }
        }

        const rowMonth =
          y && m
            ? `${y}-${String(m).padStart(2, "0")}`
            : "";

        if (rowMonth !== month) continue;

        exactRows.push({
          date: "",
          consultations: Number(consultCell?.v ?? 0) || 0,
          surgeries: 0,
        });
      }

      return exactRows.length > 0
        ? exactRows.reduce((sum, row) => sum + row.consultations, 0)
        : conversion.consultations;
    })(),

    surgeries: (() => {
      const values: number[] = [];
      const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");

      for (let r = 5; r <= range.e.r; r++) {
        const dateCell = sheet[XLSX.utils.encode_cell({ r, c: 24 })];
        const surgeryCell = sheet[XLSX.utils.encode_cell({ r, c: 27 })];

        if (!dateCell) continue;

        const rawDate = dateCell.v;
        let y = 0;
        let m = 0;

        if (rawDate instanceof Date) {
          y = rawDate.getFullYear();
          m = rawDate.getMonth() + 1;
        } else if (typeof rawDate === "number") {
          const parsed = XLSX.SSF.parse_date_code(rawDate);
          if (parsed) {
            y = parsed.y;
            m = parsed.m;
          }
        } else {
          const match = String(rawDate).match(
            /^(\\d{4})[-./](\\d{1,2})/
          );
          if (match) {
            y = Number(match[1]);
            m = Number(match[2]);
          }
        }

        const rowMonth =
          y && m
            ? `${y}-${String(m).padStart(2, "0")}`
            : "";

        if (rowMonth !== month) continue;

        values.push(Number(surgeryCell?.v ?? 0) || 0);
      }

      return values.length > 0
        ? values.reduce((sum, value) => sum + value, 0)
        : conversion.surgeries;
    })(),

    conversionScore: conversion.score,"""

if old not in s:
    raise RuntimeError(
        "807번 반환 블록을 찾지 못했습니다. 파일 변경 안 함."
    )

s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

print("========================================")
print(" EXACT DAILY CONVERSION PATCH COMPLETE")
print("========================================")
print("Y  = 날짜")
print("AA = 상담")
print("AB = 수술전환")
print("backup:", bak)
