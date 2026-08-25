"use client";

import {
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type PlatformRow = {
  name: string;
  applications: number;
  reservations: number;
  rate: number;
};

type DailyRow = {
  date: string;

  applications: number;
  reservations: number;
  rate: number;

  platforms: PlatformRow[];

  previousCall: {
    total: number;

    details: Record<
      string,
      number
    >;
  };

  sevenCall: {
    total: number;

    details: Record<
      string,
      number
    >;
  };

  visitSources: {
    source: string;
    count: number;
  }[];

  incall: {
    total: number;
    newCount: number;
    simpleCount: number;
    changedCount: number;
    canceledCount: number;
  };

  cancellationCount: number;
};

type DailyData = {
  month: string;

  summary: {
    applications: number;
    reservations: number;
    rate: number;
    incall: number;
    newIncall: number;
    cancellations: number;
  };

  days: DailyRow[];
};

type WeekGroup = {
  week: number;
  label: string;
  days: DailyRow[];
};

function dayNumber(
  date: string
) {
  return Number(
    date.slice(
      8,
      10
    )
  );
}

function formatDate(
  date: string
) {
  return `${dayNumber(
    date
  )}일`;
}

function formatFullDate(
  date: string
) {
  const [
    year,
    month,
    day,
  ] =
    date.split("-");

  return `${year}년 ${Number(
    month
  )}월 ${Number(
    day
  )}일`;
}

/*
  1~7    1주차
  8~14   2주차
  15~21  3주차
  22~28  4주차
  29~31  5주차
*/
function getWeekNumber(
  date: string
) {
  return Math.floor(
    (dayNumber(date) - 1) /
      7
  ) + 1;
}

function buildWeeks(
  days: DailyRow[]
): WeekGroup[] {
  const map =
    new Map<
      number,
      DailyRow[]
    >();

  for (const day of days) {
    const week =
      getWeekNumber(
        day.date
      );

    const existing =
      map.get(week) ??
      [];

    existing.push(day);

    map.set(
      week,
      existing
    );
  }

  return Array.from(
    map.entries()
  )
    .sort(
      ([a], [b]) =>
        a - b
    )
    .map(
      ([week, rows]) => {
        const sorted =
          [...rows].sort(
            (a, b) =>
              a.date.localeCompare(
                b.date
              )
          );

        const first =
          dayNumber(
            sorted[0].date
          );

        const last =
          dayNumber(
            sorted[
              sorted.length - 1
            ].date
          );

        return {
          week,

          label:
            `${week}주차 · ` +
            `${first}일 ~ ${last}일`,

          days:
            sorted,
        };
      }
    );
}

function DetailChips({
  data,
}: {
  data: Record<
    string,
    number
  >;
}) {
  const entries =
    Object.entries(data);

  if (
    entries.length === 0
  ) {
    return (
      <span className="text-xs text-zinc-400">
        세부내역 없음
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(
        ([key, value]) => (
          <span
            key={key}
            className="rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-600"
          >
            {key}{" "}
            <strong>
              {value}
            </strong>
          </span>
        )
      )}
    </div>
  );
}

function DailyDetail({
  day,
}: {
  day: DailyRow;
}) {
  return (
    <div className="border-t border-zinc-100 bg-[#fbfbfc] p-5">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* DB 보고 */}

        <section>
          <h4 className="mb-3 text-sm font-bold">
            DB 보고내역
          </h4>

          <div className="grid gap-2 sm:grid-cols-2">
            {day.platforms.map(
              (platform) => (
                <div
                  key={
                    platform.name
                  }
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2"
                >
                  <strong className="text-sm">
                    {
                      platform.name
                    }
                  </strong>

                  <span className="text-xs">
                    신청{" "}
                    <b className="text-blue-600">
                      {
                        platform.applications
                      }
                    </b>
                    {" / "}
                    예약{" "}
                    <b className="text-violet-600">
                      {
                        platform.reservations
                      }
                    </b>
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        {/* 총인콜 */}

        <section>
          <h4 className="mb-3 text-sm font-bold">
            총인콜
          </h4>

          <div className="grid grid-cols-5 gap-2">
            {[
              [
                "총",
                day.incall
                  .total,
              ],
              [
                "신규",
                day.incall
                  .newCount,
              ],
              [
                "단순",
                day.incall
                  .simpleCount,
              ],
              [
                "변경",
                day.incall
                  .changedCount,
              ],
              [
                "취소",
                day.incall
                  .canceledCount,
              ],
            ].map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={label}
                  className="rounded-lg bg-white p-3 text-center ring-1 ring-zinc-100"
                >
                  <p className="text-[11px] text-zinc-400">
                    {label}
                  </p>

                  <p className="mt-1 font-bold">
                    {value}
                  </p>
                </div>
              )
            )}
          </div>
        </section>

        {/* 전날콜 */}

        <section>
          <h4 className="mb-2 text-sm font-bold">
            전날콜
          </h4>

          <div className="mb-2 text-sm">
            총{" "}
            <strong>
              {
                day
                  .previousCall
                  .total
              }
            </strong>
          </div>

          <DetailChips
            data={
              day
                .previousCall
                .details
            }
          />
        </section>

        {/* 7콜 */}

        <section>
          <h4 className="mb-2 text-sm font-bold">
            7콜
          </h4>

          <div className="mb-2 text-sm">
            총{" "}
            <strong>
              {
                day.sevenCall
                  .total
              }
            </strong>
          </div>

          <DetailChips
            data={
              day.sevenCall
                .details
            }
          />
        </section>
      </div>

      {/* 내원경로 */}

      <section className="mt-6">
        <h4 className="mb-3 text-sm font-bold">
          내원경로
        </h4>

        {day.visitSources
          .length >
        0 ? (
          <div className="flex flex-wrap gap-2">
            {day.visitSources.map(
              (source) => (
                <span
                  key={
                    source.source
                  }
                  className="rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-zinc-200"
                >
                  {
                    source.source
                  }{" "}
                  <strong>
                    {
                      source.count
                    }
                  </strong>
                </span>
              )
            )}
          </div>
        ) : (
          <span className="text-xs text-zinc-400">
            데이터 없음
          </span>
        )}
      </section>

      <div className="mt-6 border-t border-zinc-200 pt-4 text-sm">
        당일취소{" "}
        <strong className="text-red-500">
          {
            day.cancellationCount
          }
          건
        </strong>
      </div>
    </div>
  );
}

export default function DailyDashboard({
  month,
}: {
  month: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<DailyData | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    expandedDates,
    setExpandedDates,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      setLoading(true);

      try {
        const response =
          await fetch(
            `/api/daily?month=${encodeURIComponent(
              month
            )}&t=${Date.now()}`,
            {
              cache:
                "no-store",
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.ok
        ) {
          throw new Error(
            result.message
          );
        }

        if (!cancelled) {
          setData(
            result.data
          );

          setExpandedDates(
            new Set()
          );
        }
      } catch (error) {
        console.error(
          error
        );

        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [month]);

  const weeks =
    useMemo(
      () =>
        buildWeeks(
          data?.days ??
            []
        ),
      [data]
    );

  function toggleDate(
    date: string
  ) {
    setExpandedDates(
      (previous) => {
        const next =
          new Set(
            previous
          );

        if (
          next.has(date)
        ) {
          next.delete(date);
        } else {
          next.add(date);
        }

        return next;
      }
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2
          size={27}
          className="animate-spin text-blue-600"
        />
      </div>
    );
  }

  if (
    !data ||
    data.days.length ===
      0
  ) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
        <p className="font-semibold">
          해당 월의 일별 데이터가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 월 요약 */}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="신청"
          value={
            data.summary
              .applications
          }
          className="text-blue-600"
        />

        <SummaryCard
          label="예약"
          value={
            data.summary
              .reservations
          }
          className="text-violet-600"
        />

        <SummaryCard
          label="예약 전환율"
          value={`${data.summary.rate.toFixed(
            1
          )}%`}
        />

        <SummaryCard
          label="총인콜"
          value={
            data.summary
              .incall
          }
        />

        <SummaryCard
          label="신규 인콜"
          value={
            data.summary
              .newIncall
          }
        />

        <SummaryCard
          label="당취"
          value={`${data.summary.cancellations}건`}
          className="text-red-500"
        />
      </section>

      {/* 주별 */}

      {weeks.map(
        (week) => {
          const weekApplications =
            week.days.reduce(
              (
                sum,
                day
              ) =>
                sum +
                day.applications,
              0
            );

          const weekReservations =
            week.days.reduce(
              (
                sum,
                day
              ) =>
                sum +
                day.reservations,
              0
            );

          const weekRate =
            weekApplications >
            0
              ? (weekReservations /
                  weekApplications) *
                100
              : 0;

          return (
            <section
              key={
                week.week
              }
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
            >
              {/* 주 헤더 */}

              <div className="flex flex-col justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-4 md:flex-row md:items-center">
                <div>
                  <h2 className="font-bold">
                    {
                      week.label
                    }
                  </h2>

                  <p className="mt-1 text-xs text-zinc-400">
                    날짜를 누르면 상세 보고가 펼쳐집니다.
                  </p>
                </div>

                <div className="flex gap-4 text-sm">
                  <span className="font-bold text-blue-600">
                    신청{" "}
                    {
                      weekApplications
                    }
                  </span>

                  <span className="font-bold text-violet-600">
                    예약{" "}
                    {
                      weekReservations
                    }
                  </span>

                  <span className="font-bold">
                    {weekRate.toFixed(
                      1
                    )}
                    %
                  </span>
                </div>
              </div>

              {/* 일자 테이블 */}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                      <th className="px-5 py-3">
                        날짜
                      </th>

                      <th className="px-3 py-3 text-right">
                        신청
                      </th>

                      <th className="px-3 py-3 text-right">
                        예약
                      </th>

                      <th className="px-3 py-3 text-right">
                        전환율
                      </th>

                      <th className="px-3 py-3 text-right">
                        총인콜
                      </th>

                      <th className="px-3 py-3 text-right">
                        신규
                      </th>

                      <th className="px-3 py-3 text-right">
                        당취
                      </th>

                      <th className="w-10" />
                    </tr>
                  </thead>

                  <tbody>
                    {week.days.map(
                      (day) => {
                        const expanded =
                          expandedDates.has(
                            day.date
                          );

                        return (
                          <>
                            <tr
                              key={
                                day.date
                              }
                              onClick={() =>
                                toggleDate(
                                  day.date
                                )
                              }
                              className="cursor-pointer border-b border-zinc-100 transition hover:bg-blue-50/40"
                            >
                              <td className="px-5 py-4 font-bold">
                                {formatDate(
                                  day.date
                                )}
                              </td>

                              <td className="px-3 py-4 text-right font-bold text-blue-600">
                                {
                                  day.applications
                                }
                              </td>

                              <td className="px-3 py-4 text-right font-bold text-violet-600">
                                {
                                  day.reservations
                                }
                              </td>

                              <td className="px-3 py-4 text-right font-semibold">
                                {day.rate.toFixed(
                                  1
                                )}
                                %
                              </td>

                              <td className="px-3 py-4 text-right">
                                {
                                  day.incall
                                    .total
                                }
                              </td>

                              <td className="px-3 py-4 text-right">
                                {
                                  day.incall
                                    .newCount
                                }
                              </td>

                              <td className="px-3 py-4 text-right font-semibold text-red-500">
                                {
                                  day.cancellationCount
                                }
                              </td>

                              <td className="px-3 py-4 text-center">
                                {expanded ? (
                                  <ChevronUp
                                    size={
                                      17
                                    }
                                  />
                                ) : (
                                  <ChevronDown
                                    size={
                                      17
                                    }
                                  />
                                )}
                              </td>
                            </tr>

                            {expanded && (
                              <tr
                                key={`${day.date}-detail`}
                              >
                                <td
                                  colSpan={
                                    8
                                  }
                                  className="p-0"
                                >
                                  <div className="border-l-4 border-blue-500">
                                    <div className="border-b border-zinc-100 bg-blue-50/30 px-5 py-3 text-sm font-bold">
                                      {formatFullDate(
                                        day.date
                                      )}{" "}
                                      상세 보고
                                    </div>

                                    <DailyDetail
                                      day={
                                        day
                                      }
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value:
    | string
    | number;
  className?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${className}`}
      >
        {typeof value ===
        "number"
          ? value.toLocaleString(
              "ko-KR"
            )
          : value}
      </p>
    </div>
  );
}