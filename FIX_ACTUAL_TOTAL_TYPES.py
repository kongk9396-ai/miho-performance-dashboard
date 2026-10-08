from pathlib import Path
from datetime import datetime
import shutil

p = Path("app/api/admin/import/preview/route.ts")
s = p.read_text(encoding="utf-8-sig")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = Path(str(p) + f".bak_actual_total_typefix_{stamp}")
shutil.copy2(p, bak)

# 1) MonthAccumulator 타입에 actualSurgeries 추가
start = s.find("type MonthAccumulator = {")
if start < 0:
    raise RuntimeError("MonthAccumulator 타입 못 찾음")

end = s.find("};", start)
block = s[start:end]

if "actualSurgeries:" not in block:
    marker = "  consultations:"
    pos = block.find(marker)
    if pos < 0:
        raise RuntimeError("MonthAccumulator consultations 못 찾음")

    block = (
        block[:pos]
        + "  actualSurgeries: number | null;\n"
        + block[pos:]
    )

    s = s[:start] + block + s[end:]

print("OK 1/3 MonthAccumulator 타입")


# 2) parseSheet return에 actualSurgeries 추가
# 에러 난 1714 근처 return 블록
needle = '''    dailyConversions: dailyConversion.rows,
'''

if needle not in s:
    raise RuntimeError("parseSheet dailyConversions return 못 찾음")

# 첫 번째 실제 parseSheet return에만 추가
idx = s.find(needle)

near = s[idx:idx+400]

if "actualSurgeries:" not in near:
    replacement = '''    dailyConversions: dailyConversion.rows,
    actualSurgeries:
      dailyConversion.actualSurgeries ?? null,
'''

    s = s[:idx] + s[idx:].replace(
        needle,
        replacement,
        1
    )

print("OK 2/3 SheetCandidate return")


# 3) 혹시 SheetCandidate 타입은 required라서
# 다른 fallback candidate가 못 넣을 수도 있으니 optional 대신 null 허용 유지
# 그리고 비교용 후보 생성부에 actualSurgeries: null 누락된 곳 보정

# 월 candidate 객체들 중 dailyConversions는 있는데 actualSurgeries 없는 곳
search_from = 0
count = 0

while True:
    pos = s.find("dailyConversions:", search_from)
    if pos < 0:
        break

    # 객체 범위 대충 앞뒤 500자만 확인
    chunk_start = max(0, pos - 400)
    chunk_end = min(len(s), pos + 500)
    chunk = s[chunk_start:chunk_end]

    if "return {" in chunk and "actualSurgeries:" not in chunk:
        # 해당 dailyConversions 줄 뒤에 null 추가
        line_end = s.find("\n", pos)
        if line_end > 0:
            indent_start = s.rfind("\n", 0, pos) + 1
            indent = s[indent_start:pos]
            insert = f"\n{indent}actualSurgeries: null,"
            s = s[:line_end] + insert + s[line_end:]
            count += 1
            search_from = line_end + len(insert)
            continue

    search_from = pos + 1

print(f"OK 3/3 fallback candidate 보정: {count}곳")

p.write_text(s, encoding="utf-8")

print("")
print("====================================")
print(" ACTUAL SURGERY TYPE CHAIN FIXED")
print("====================================")
print("backup:", bak.name)
