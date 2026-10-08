from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/ManualConversionManager.tsx")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_disable_holidays_{stamp}")
shutil.copy2(p, bak)

# ==========================================================
# 1. createDailyRows에서 일요일/공휴일은 무조건 0
# ==========================================================

old = '''      return {
        date,

        actualSurgeries:
          Number(
            existingRow
              ?.actualSurgeries ??
              0
          ),

        consultations:
          Number(
            existingRow
              ?.consultations ??
              0
          ),

        surgeries:
          Number(
            existingRow
              ?.surgeries ??
              0
          ),
      };'''

new = '''      const isHoliday =
        isSundayOrKrHoliday(
          date
        );

      return {
        date,

        actualSurgeries:
          isHoliday
            ? 0
            : Number(
                existingRow
                  ?.actualSurgeries ??
                  0
              ),

        consultations:
          isHoliday
            ? 0
            : Number(
                existingRow
                  ?.consultations ??
                  0
              ),

        surgeries:
          isHoliday
            ? 0
            : Number(
                existingRow
                  ?.surgeries ??
                  0
              ),
      };'''

if old not in s:
    raise RuntimeError("createDailyRows 블록 못 찾음")

s = s.replace(old, new, 1)


# ==========================================================
# 2. NumberInput에 disabled 옵션 추가
# ==========================================================

old = '''function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange:
    (value: number) => void;
}) {'''

new = '''function NumberInput({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange:
    (value: number) => void;
  disabled?: boolean;
}) {'''

if old not in s:
    raise RuntimeError("NumberInput 선언 못 찾음")

s = s.replace(old, new, 1)


# input에 disabled 추가
old = '''      type="number"
      min={0}
      value={'''

new = '''      type="number"
      min={0}
      disabled={disabled}
      value={'''

s = s.replace(old, new, 1)


# disabled 스타일
old = '''        focus:border-blue-500
        focus:ring-2
        focus:ring-blue-100
      "'''

new = '''        focus:border-blue-500
        focus:ring-2
        focus:ring-blue-100
        disabled:cursor-not-allowed
        disabled:bg-zinc-100
        disabled:text-zinc-400
      "'''

s = s.replace(old, new, 1)


# ==========================================================
# 3. 저장할 때도 일요일/공휴일 강제로 0
# ==========================================================

old = '''                section:
                  "daily",
                daily,
              }),'''

new = '''                section:
                  "daily",

                daily:
                  daily.map(
                    (row) =>
                      isSundayOrKrHoliday(
                        row.date
                      )
                        ? {
                            ...row,
                            actualSurgeries: 0,
                            consultations: 0,
                            surgeries: 0,
                          }
                        : row
                  ),
              }),'''

if old not in s:
    raise RuntimeError("saveDaily body 못 찾음")

s = s.replace(old, new, 1)


# ==========================================================
# 4. 일별 input 3개 모두 disabled={isHolidayRow}
# ==========================================================

# actualSurgeries
old = '''                          value={
                            row.actualSurgeries
                          }
                          onChange={'''

new = '''                          value={
                            row.actualSurgeries
                          }
                          disabled={
                            isHolidayRow
                          }
                          onChange={'''

if old not in s:
    raise RuntimeError("수술 수 input 못 찾음")

s = s.replace(old, new, 1)


# consultations
old = '''                          value={
                            row.consultations
                          }
                          onChange={'''

new = '''                          value={
                            row.consultations
                          }
                          disabled={
                            isHolidayRow
                          }
                          onChange={'''

if old not in s:
    raise RuntimeError("상담 input 못 찾음")

s = s.replace(old, new, 1)


# surgeries
old = '''                          value={
                            row.surgeries
                          }
                          onChange={'''

new = '''                          value={
                            row.surgeries
                          }
                          disabled={
                            isHolidayRow
                          }
                          onChange={'''

if old not in s:
    raise RuntimeError("수술 결정 input 못 찾음")

s = s.replace(old, new, 1)


p.write_text(s, encoding="utf-8")

print("")
print("====================================")
print(" HOLIDAY INPUT LOCK FIX COMPLETE")
print("====================================")
print("일요일       : 입력 금지 + 저장 0")
print("한국 공휴일  : 입력 금지 + 저장 0")
print("토요일       : 정상 입력")
print("평일         : 정상 입력")
print("backup:", bak.name)
