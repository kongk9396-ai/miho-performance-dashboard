from pathlib import Path
from datetime import datetime
import shutil

p = Path("components/ExcelImportManager.tsx")
s = p.read_text(encoding="utf-8")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_conversion_hook_{stamp}")
shutil.copy2(p, bak)

# 기존 commit fetch 위치
needle = '''        "/api/admin/import/commit",'''

pos = s.find(needle)

if pos < 0:
    raise RuntimeError(
        "/api/admin/import/commit 호출을 못 찾았습니다."
    )

# 기존 업로드 흐름을 깨지 않기 위해
# commit 함수 내부에서 사용되는 file/FormData 이름을
# 먼저 확인하지 않고 억지로 삽입하지 않는다.
#
# 대신 브라우저에서 기존 업로드와 독립적으로
# 호출 가능한 helper를 파일 상단에 추가한다.

helper = '''
async function uploadConversionExcel(
  file: File
) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    "/api/admin/conversion-excel",
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      result.error ??
        "상담/수술 전환 데이터 업로드 실패"
    );
  }

  return result;
}

'''

if "async function uploadConversionExcel" not in s:
    # 첫 import 블록 뒤가 아니라 파일 최상단에
    # function 선언을 넣어도 TS module에서 정상.
    # import보다 앞에 두면 lint 문제 가능하므로
    # 마지막 import 뒤에 삽입.

    lines = s.splitlines(True)

    last_import = -1

    for i, line in enumerate(lines):
      if (
        line.startswith("import ") or
        (
          last_import >= 0 and
          (
            line.startswith("  ") or
            line.startswith("}")
          )
        )
      ):
        if line.rstrip().endswith(";"):
          last_import = i

    # 안전하게 첫 컴포넌트 선언 직전에 삽입
    markers = [
      "export default function",
      "export function",
      "function ExcelImportManager",
    ]

    insert = -1

    for marker in markers:
      x = s.find(marker)

      if x >= 0:
        if insert < 0 or x < insert:
          insert = x

    if insert < 0:
      raise RuntimeError(
        "ExcelImportManager 컴포넌트 시작을 못 찾았습니다."
      )

    s = (
      s[:insert]
      + helper
      + s[insert:]
    )

p.write_text(s, encoding="utf-8")

print("helper 추가 완료")
print("backup:", bak)
