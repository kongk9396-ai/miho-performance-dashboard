from pathlib import Path
import shutil
from datetime import datetime

ROOT = Path(r"C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard")
stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

files = [
    ROOT / "lib/db/schema.ts",
    ROOT / "lib/db/queries.ts",
    ROOT / "app/api/admin/import/preview/route.ts",
    ROOT / "app/api/admin/import/commit/route.ts",
    ROOT / "components/DashboardClient.tsx",
]

print("===== BACKUP =====")

for p in files:
    if not p.exists():
        raise SystemExit(f"파일 없음: {p}")

    backup = Path(str(p) + f".bak_doctor_{stamp}")
    shutil.copy2(p, backup)
    print("BACKUP:", p.name)

print("")
print("===== CURRENT STRUCTURE CHECK =====")

checks = {
    "schema": [
        "dailyConversionStats",
        "monthlyConversionStats",
    ],
    "queries": [
        "dailyConversions",
    ],
    "preview": [
        "dailyConversions",
        "parseDailyConversionLayout",
    ],
    "commit": [
        "dailyConversionStats",
        "dailyConversions",
    ],
    "dashboard": [
        "상담 대비 수술 전환",
        "dailyConversions",
    ],
}

texts = {
    "schema": files[0].read_text(encoding="utf-8"),
    "queries": files[1].read_text(encoding="utf-8"),
    "preview": files[2].read_text(encoding="utf-8"),
    "commit": files[3].read_text(encoding="utf-8"),
    "dashboard": files[4].read_text(encoding="utf-8"),
}

for name, needles in checks.items():
    for needle in needles:
        if needle not in texts[name]:
            raise SystemExit(
                f"중단: {name}에서 '{needle}' 못 찾음. 파일 수정 안 함."
            )

print("기존 일별 conversion 구조 확인 OK")
print("백업 완료:", stamp)

# ---------------------------------------------------------
# 현재 코드의 정확한 삽입 지점을 파일로 뽑는다.
# 임의 치환하지 않고 다음 패치가 이 결과를 사용한다.
# ---------------------------------------------------------

out = ROOT / "DOCTOR_PATCH_CONTEXT.txt"

def contexts(text, terms, radius=1400):
    chunks = []

    for term in terms:
        start = 0

        while True:
            pos = text.find(term, start)

            if pos < 0:
                break

            a = max(0, pos - radius)
            b = min(len(text), pos + len(term) + radius)

            chunks.append(
                f"\n\n===== {term} @ {pos} =====\n"
                + text[a:b]
            )

            start = pos + len(term)

    return "".join(chunks)

result = []

result.append(
    "===== SCHEMA =====\n" +
    contexts(
        texts["schema"],
        [
            "dailyConversionStats",
            "monthlyConversionStats",
        ],
        1800,
    )
)

result.append(
    "\n===== QUERIES =====\n" +
    contexts(
        texts["queries"],
        [
            "dailyConversionRows",
            "const dailyConversions",
            "dailyConversions,",
        ],
        1800,
    )
)

result.append(
    "\n===== PREVIEW =====\n" +
    contexts(
        texts["preview"],
        [
            "type DailyConversionRow",
            "type SheetCandidate",
            "function parseDailyConversionLayout",
            "function parseSheet",
            "function mergeCandidate",
            "dailyConversions,",
        ],
        1800,
    )
)

result.append(
    "\n===== COMMIT =====\n" +
    contexts(
        texts["commit"],
        [
            "type ImportMonth",
            "incomingDailyConversions",
            "dailyConversionRowsSaved",
        ],
        1800,
    )
)

result.append(
    "\n===== DASHBOARD =====\n" +
    contexts(
        texts["dashboard"],
        [
            "type DashboardData",
            "상담 대비 수술 전환",
            "일별 상담/수술전환 데이터가 없습니다",
        ],
        2200,
    )
)

out.write_text(
    "\n".join(result),
    encoding="utf-8",
)

print("")
print("========================================")
print("READY FOR DOCTOR PATCH")
print("========================================")
print(out)
