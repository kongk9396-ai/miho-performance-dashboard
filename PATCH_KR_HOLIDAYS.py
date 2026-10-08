from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/ManualConversionManager.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_holiday_{stamp}")
shutil.copy2(p, bak)

# 1) import 추가
if 'import Holidays from "date-holidays";' not in s:
    marker = '"use client";'
    s = s.replace(
        marker,
        marker + '\n\nimport Holidays from "date-holidays";',
        1
    )

# 2) 헬퍼 추가
helper = r'''
const krHolidays = new Holidays("KR");
const holidayCache = new Map<number, Set<string>>();

function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getHolidaySet(year: number) {
  const cached = holidayCache.get(year);

  if (cached) {
    return cached;
  }

  const holidaySet = new Set(
    krHolidays
      .getHolidays(year)
      .filter((holiday) => holiday.type === "public")
      .map((holiday) => {
        const date = new Date(holiday.date);
        return toYmd(date);
      })
  );

  holidayCache.set(year, holidaySet);

  return holidaySet;
}

function isSundayOrKrHoliday(dateString: string) {
  const date = new Date(`${dateString}T12:00:00+09:00`);
  const isSunday = date.getDay() === 0;

  return (
    isSunday ||
    getHolidaySet(date.getFullYear()).has(dateString)
  );
}
'''

if "function isSundayOrKrHoliday" not in s:
    marker = 'const DOCTORS = ['
    pos = s.find(marker)

    if pos < 0:
        raise RuntimeError("DOCTORS 위치 못 찾음")

    s = s[:pos] + helper + "\n" + s[pos:]

# 3) daily.map 안에 isHolidayRow 추가
old = '''                  const rowRate =
                    rate(
                      row.surgeries,
                      row.consultations
                    );'''

new = '''                  const isHolidayRow =
                    isSundayOrKrHoliday(
                      row.date
                    );

                  const rowRate =
                    rate(
                      row.surgeries,
                      row.consultations
                    );'''

if old in s and "const isHolidayRow" not in s[s.find("daily.map"):]:
    s = s.replace(old, new, 1)

# 4) tr className 교체
old = '''                      className="
                        border-b
                        border-zinc-100
                        hover:bg-zinc-50
                      "'''

new = '''                      className={
                        isHolidayRow
                          ? "border-b border-zinc-100 bg-zinc-100"
                          : "border-b border-zinc-100 bg-white hover:bg-zinc-50"
                      }'''

if old in s:
    s = s.replace(old, new, 1)

# 5) 날짜 글자도 회색
old = '''                      <td className="px-4 py-2.5 text-sm font-bold text-zinc-700">
                        {row.date}
                      </td>'''

new = '''                      <td
                        className={
                          isHolidayRow
                            ? "px-4 py-2.5 text-sm font-bold text-zinc-400"
                            : "px-4 py-2.5 text-sm font-bold text-zinc-700"
                        }
                      >
                        {row.date}
                      </td>'''

if old in s:
    s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

print("====================================")
print(" SUNDAY + KR HOLIDAY STYLE PATCHED")
print("====================================")
print("토요일: 정상")
print("일요일: 회색")
print("한국 공휴일: 회색")
print("backup:", bak.name)
