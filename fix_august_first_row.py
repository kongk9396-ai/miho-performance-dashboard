from pathlib import Path
from datetime import datetime
import shutil

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_aug1_fix_{stamp}")
shutil.copy2(p, bak)

old = '''    const date =
      toDateString(
        rawDate,
        month
      );

    if (!date) {
      continue;
    }

    if (
      monthKey(date) !==
      monthKey(month)
    ) {
      continue;
    }'''

new = '''    /*
     * 날짜 셀이 수식인 첫 행도 놓치지 않도록 처리.
     *
     * MIHO 일별표는 헤더 다음 행부터
     * 1일, 2일, 3일 ... 순서로 고정되어 있다.
     */
    let date =
      toDateString(
        rawDate,
        month
      );

    if (
      !date ||
      monthKey(date) !==
        monthKey(month)
    ) {
      const day =
        r - headerRow;

      const baseMonth =
        monthKey(month);

      date =
        `${baseMonth}-${String(day).padStart(2, "0")}`;
    }'''

if old not in s:
    raise RuntimeError(
        "날짜 처리 블록을 못 찾았습니다. 파일은 수정하지 않았습니다."
    )

s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

print("")
print("====================================")
print(" AUGUST FIRST ROW FIX COMPLETE")
print("====================================")
print("8/1 상담 20 포함")
print("8/1 수술전환 4 포함")
print("예상 8월 합계: 상담 329 / 수술전환 42")
print("예상 전환율: 12.77%")
print("backup:", bak.name)
