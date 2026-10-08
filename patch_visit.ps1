cd "C:\Users\영상박가람\OneDrive\바탕 화면\miho-performance-dashboard"
$stamp = Get-Date -Format yyyyMMdd_HHmmss
$utf8 = New-Object Text.UTF8Encoding $false

$qPath = (Resolve-Path ".\lib\db\queries.ts").Path
$cPath = (Resolve-Path ".\components\DashboardClient.tsx").Path
Copy-Item $qPath "$qPath.bak_visit_$stamp"
Copy-Item $cPath "$cPath.bak_visit_$stamp"

$qBlock = @'
  /*
    VISIT_SOURCE_BY_ROUTE
    월별 내원경로 집계 (경로별로 따로 합산)
    표기만 다른 같은 경로는 하나로 통일한다.
  */
  function normalizeVisitSource(
    value: string
  ) {
    const rawSource =
      String(value ?? "").trim();

    const compact =
      rawSource
        .replace(/\s+/g, "")
        .toLowerCase();

    if (
      ["유튜브", "유투브", "유튭", "유트브", "youtube", "yt"].includes(compact)
    ) {
      return "유튜브";
    }

    if (
      ["메타광고", "매타광고", "메타", "매타", "meta", "meta광고"].includes(compact)
    ) {
      return "메타광고";
    }

    if (
      ["강남언니", "강언"].includes(compact)
    ) {
      return "강남언니";
    }

    return rawSource;
  }

  function buildVisitSources(
    targetMonth: string
  ) {
    const map =
      new Map<string, number>();

    for (const row of visitSourceRows) {
      if (
        String(row.date).slice(0, 7) !==
        String(targetMonth).slice(0, 7)
      ) {
        continue;
      }

      const source =
        normalizeVisitSource(row.source);

      if (!source) {
        continue;
      }

      map.set(
        source,
        (map.get(source) ?? 0) +
          Number(row.count ?? 0)
      );
    }

    return Array.from(map.entries())
      .map(([source, count]) => ({
        source,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  const monthlyVisitSources =
    buildVisitSources(month);

  const previousVisitSources =
    buildVisitSources(previousMonth);

  const totalVisitSourceCount =
    monthlyVisitSources.reduce(
      (sum, row) => sum + row.count,
      0
    );

'@

$comp = @'
/*
  VISIT_SOURCE_TABLE
  내원경로별 집계 (전월 대비)
*/
function VisitSourceTable({
  current,
  previous,
}: {
  current: { source: string; count: number }[];
  previous: { source: string; count: number }[];
}) {
  const currentMap = new Map(
    current.map((row) => [row.source, row.count])
  );

  const previousMap = new Map(
    previous.map((row) => [row.source, row.count])
  );

  const names = Array.from(
    new Set([
      ...current.map((row) => row.source),
      ...previous.map((row) => row.source),
    ])
  );

  const currentTotal = current.reduce(
    (sum, row) => sum + row.count,
    0
  );

  const previousTotal = previous.reduce(
    (sum, row) => sum + row.count,
    0
  );

  const rows = names
    .map((name) => {
      const now = currentMap.get(name) ?? 0;
      const before = previousMap.get(name) ?? 0;

      return {
        name,
        now,
        before,
        delta: now - before,
        share:
          currentTotal > 0
            ? (now / currentTotal) * 100
            : 0,
      };
    })
    .sort(
      (a, b) =>
        b.now - a.now || b.before - a.before
    );

  const Delta = ({ value }: { value: number }) => {
    if (value > 0) {
      return (
        <span className="font-bold text-red-500">
          ▲ {value.toLocaleString()}
        </span>
      );
    }

    if (value < 0) {
      return (
        <span className="font-bold text-blue-600">
          ▼ {Math.abs(value).toLocaleString()}
        </span>
      );
    }

    return (
      <span className="font-semibold text-zinc-400">
        -
      </span>
    );
  };

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-zinc-950">
          내원경로별 집계
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          DB보고 내원경로 기준 · 전월 대비 (플랫폼 신청/예약과 별도 집계)
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-400">
          등록된 내원경로 데이터가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-zinc-200 bg-zinc-50 text-zinc-600">
                <th className="px-4 py-3 text-left font-semibold">
                  내원경로
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  전월
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  당월
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  증감
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  당월 비중
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-zinc-100 transition hover:bg-zinc-50"
                >
                  <td className="px-4 py-4 font-bold text-zinc-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-4 text-right text-zinc-500">
                    {row.before.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-zinc-950">
                    {row.now.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Delta value={row.delta} />
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-blue-600">
                    {row.share.toFixed(1)}%
                  </td>
                </tr>
              ))}

              <tr className="bg-zinc-50">
                <td className="px-4 py-4 font-black text-zinc-950">
                  합계
                </td>
                <td className="px-4 py-4 text-right font-bold text-zinc-500">
                  {previousTotal.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-right font-black text-zinc-950">
                  {currentTotal.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-right">
                  <Delta value={currentTotal - previousTotal} />
                </td>
                <td className="px-4 py-4 text-right font-bold text-zinc-400">
                  100%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

'@

$render = @'

            <section className="mt-6">
              <VisitSourceTable
                current={dashboardData.monthlyVisitSources ?? []}
                previous={dashboardData.previousVisitSources ?? []}
              />
            </section>

'@

$q = [IO.File]::ReadAllText($qPath, [Text.Encoding]::UTF8)
$q = [regex]::Replace($q, '(?s)  const visitSourceMap =.*?(?=  const dailyConversions =)', { param($m) $qBlock })
$q = [regex]::Replace($q, 'monthlyVisitSources,\s*totalVisitSourceCount,', { param($m) "monthlyVisitSources,`n    previousVisitSources,`n    totalVisitSourceCount," })
[IO.File]::WriteAllText($qPath, $q, $utf8)

$c = [IO.File]::ReadAllText($cPath, [Text.Encoding]::UTF8)
$c = $c.Replace('totalVisitSourceCount: number;', "totalVisitSourceCount: number;`n  previousVisitSources?: { source: string; count: number }[];")
$c = $c.Replace('export default function DashboardClient(', $comp + 'export default function DashboardClient(')
$c = ([regex]'(?s)(<PlatformDetailTable.*?</section>)').Replace($c, { param($m) $m.Value + $render.TrimEnd() }, 1)
[IO.File]::WriteAllText($cPath, $c, $utf8)

"서버 집계 추가: " + ($q.Contains("VISIT_SOURCE_BY_ROUTE") -and $q.Contains("previousVisitSources,"))
"화면 표 추가: " + ($c.Contains("VISIT_SOURCE_TABLE") -and $c.Contains("<VisitSourceTable"))
