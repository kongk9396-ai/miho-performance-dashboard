"use client";

import CategoryTrendChart from "@/components/CategoryTrendChart";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Loader2,
  Settings,
  TrendingUp,
} from "lucide-react";

import { useState } from "react";

import DailyDashboard from "@/components/DailyDashboard";

type PlatformStat = {
  name: string;
  applications: number;
  reservations: number;
  rate: number;
};

type MonthData = {
  month: string;
  totalApplications: number;
  totalReservations: number;
  reservationRate: number;
  consultations: number;
  surgeries: number;
  surgeryRate: number;
  platformStats: PlatformStat[];
};

type TrendRow = {
  month: string;
  applications: number;
  reservations: number;
  consultations: number;
  surgeries: number;
};

type DashboardData = {
  selectedMonth: string;
  current: MonthData | null;
  previous: MonthData | null;
  lastYear: MonthData | null;
  monthlyTrend: TrendRow[];
  monthlyVisitSources: { source: string; count: number }[];
  totalVisitSourceCount: number;
  dailyConversions: {
    date: string;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];

  categoryConversions: {
    category: string;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];

  previousCategoryConversions: {
    category: string;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];

  dailyCategoryConversions: {
    date: string;
    category: string;
    consultations: number;
    surgeries: number;
    rate: number;
  }[];
};

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-");

  return `${year}년 ${Number(monthNumber)}월`;
}

function formatShortMonth(month: string) {
  const [year, monthNumber] = month.split("-");

  return `${year.slice(2)}.${String(
    Number(monthNumber)
  ).padStart(2, "0")}`;
}

function formatInteger(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  return value.toLocaleString("ko-KR");
}

function formatPercent(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  return `${value.toFixed(2)}%`;
}

function calculateChange(
  current: number | null | undefined,
  comparison: number | null | undefined
) {
  if (
    current === null ||
    current === undefined ||
    comparison === null ||
    comparison === undefined ||
    comparison === 0
  ) {
    return null;
  }

  return (
    ((current - comparison) /
      comparison) *
    100
  );
}

function calculatePointChange(
  current: number | null | undefined,
  comparison: number | null | undefined
) {
  if (
    current === null ||
    current === undefined ||
    comparison === null ||
    comparison === undefined
  ) {
    return null;
  }

  return current - comparison;
}

function ChangeBadge({
  value,
  unit,
}: {
  value: number | null;
  unit: "%" | "%p";
}) {
  if (value === null) {
    return (
      <span className="text-sm font-semibold text-zinc-400">
        -
      </span>
    );
  }

  const positive = value >= 0;

  return (
    <span
      className={`flex items-center gap-1 text-sm font-bold ${
        positive
          ? "text-emerald-600"
          : "text-red-500"
      }`}
    >
      {positive ? (
        <ArrowUpRight size={14} />
      ) : (
        <ArrowDownRight size={14} />
      )}

      {positive ? "+" : ""}
      {value.toFixed(
        unit === "%p" ? 2 : 1
      )}
      {unit}
    </span>
  );
}

function ComparisonLegend() {
  return (
    <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm bg-blue-600" />
        <span>이번 달</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm bg-zinc-400" />
        <span>전월</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm bg-violet-300" />
        <span>전년 동월</span>
      </div>
    </div>
  );
}

function BarItem({
  value,
  max,
  barClass,
  textClass,
  label,
}: {
  value: number | null;
  max: number;
  barClass: string;
  textClass: string;
  label: string;
}) {
  if (value === null) {
    return (
      <div className="flex w-[28%] flex-col items-center justify-end">
        <div className="mb-1 min-h-[34px] text-center">
          <span className="block text-xs font-semibold text-zinc-300">
            -
          </span>

          <span className="block whitespace-nowrap text-[10px] font-medium text-zinc-400">
            {label}
          </span>
        </div>

        <div className="h-2 w-full rounded-t-md bg-zinc-100" />
      </div>
    );
  }

  return (
    <div className="flex w-[28%] flex-col items-center justify-end">
      <div className="mb-1 min-h-[34px] text-center leading-tight">
        <span
          className={`block text-xs font-bold ${textClass}`}
        >
          {value.toLocaleString("ko-KR")}
        </span>

        <span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium text-zinc-400">
          {label}
        </span>
      </div>

      <div
        className={`w-full rounded-t-md ${barClass}`}
        style={{
          height: `${Math.max(
            (value / max) * 195,
            8
          )}px`,
        }}
      />
    </div>
  );
}

function VolumeChart({
  current,
  previous,
  lastYear,
}: {
  current: MonthData;
  previous: MonthData | null;
  lastYear: MonthData | null;
}) {
  const rows = [
    {
      name: "총 신청",
      current:
        current.totalApplications,
      previous:
        previous?.totalApplications ??
        null,
      lastYear:
        lastYear?.totalApplications ??
        null,
    },
    {
      name: "총 예약",
      current:
        current.totalReservations,
      previous:
        previous?.totalReservations ??
        null,
      lastYear:
        lastYear?.totalReservations ??
        null,
    },
    {
      name: "총 상담",
      current:
        current.consultations,
      previous:
        previous?.consultations ??
        null,
      lastYear:
        lastYear?.consultations ??
        null,
    },
    {
      name: "수술 전환",
      current:
        current.surgeries,
      previous:
        previous?.surgeries ??
        null,
      lastYear:
        lastYear?.surgeries ??
        null,
    },
  ];

  const maxValue = Math.max(
    ...rows.flatMap((row) => [
      row.current,
      row.previous ?? 0,
      row.lastYear ?? 0,
    ]),
    1
  );

  return (
    <div className="mt-5">
      <ComparisonLegend />

      <div className="flex h-[295px] items-end gap-6 border-b border-zinc-200 px-4">
        {rows.map((row) => (
          <div
            key={row.name}
            className="flex h-full flex-1 flex-col justify-end"
          >
            <div className="flex flex-1 items-end justify-center gap-2">
              <BarItem
                value={row.current}
                max={maxValue}
                barClass="bg-blue-600"
                textClass="text-blue-700"
                label={formatShortMonth(
                  current.month
                )}
              />

              <BarItem
                value={row.previous}
                max={maxValue}
                barClass="bg-zinc-400"
                textClass="text-zinc-600"
                label={
                  previous
                    ? formatShortMonth(
                        previous.month
                      )
                    : "-"
                }
              />

              <BarItem
                value={row.lastYear}
                max={maxValue}
                barClass="bg-violet-300"
                textClass="text-violet-700"
                label={
                  lastYear
                    ? formatShortMonth(
                        lastYear.month
                      )
                    : "-"
                }
              />
            </div>

            <div className="mt-3 h-10 text-center text-sm font-semibold">
              {row.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RateBar({
  label,
  value,
  monthLabel,
  barClass,
  valueClass,
}: {
  label: string;
  value: number | null;
  monthLabel: string;
  barClass: string;
  valueClass: string;
}) {
  return (
    <div className="grid grid-cols-[70px_1fr_75px] items-center gap-3">
      <span className="text-xs text-zinc-500">
        {label}
      </span>

      <div className="h-7 overflow-hidden rounded-md bg-zinc-100">
        {value !== null && (
          <div
            className={`h-full rounded-md ${barClass}`}
            style={{
              width: `${Math.min(
                Math.max(value, 0),
                100
              )}%`,
            }}
          />
        )}
      </div>

      <div className="text-right">
        <span
          className={`block text-xs font-bold ${valueClass}`}
        >
          {value === null
            ? "-"
            : `${value.toFixed(2)}%`}
        </span>

        <span className="block whitespace-nowrap text-[10px] text-zinc-400">
          {monthLabel}
        </span>
      </div>
    </div>
  );
}

function ConversionChart({
  current,
  previous,
  lastYear,
}: {
  current: MonthData;
  previous: MonthData | null;
  lastYear: MonthData | null;
}) {
  const rows = [
    {
      name: "예약 전환율",
      current:
        current.reservationRate,
      previous:
        previous?.reservationRate ??
        null,
      lastYear:
        lastYear?.reservationRate ??
        null,
    },
    {
      name:
        "상담 → 수술 전환율",
      current:
        current.surgeryRate,
      previous:
        previous?.surgeryRate ??
        null,
      lastYear:
        lastYear?.surgeryRate ??
        null,
    },
  ];

  return (
    <div className="mt-5">
      <ComparisonLegend />

      <div className="space-y-7">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold">
                {row.name}
              </span>

              <span className="text-xs text-zinc-400">
                0 ~ 100%
              </span>
            </div>

            <div className="space-y-2">
              <RateBar
                label="이번 달"
                value={row.current}
                monthLabel={formatShortMonth(
                  current.month
                )}
                barClass="bg-blue-600"
                valueClass="text-blue-700"
              />

              <RateBar
                label="전월"
                value={row.previous}
                monthLabel={
                  previous
                    ? formatShortMonth(
                        previous.month
                      )
                    : "-"
                }
                barClass="bg-zinc-400"
                valueClass="text-zinc-600"
              />

              <RateBar
                label="전년 동월"
                value={row.lastYear}
                monthLabel={
                  lastYear
                    ? formatShortMonth(
                        lastYear.month
                      )
                    : "-"
                }
                barClass="bg-violet-300"
                valueClass="text-violet-700"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({
  data,
}: {
  data: TrendRow[];
}) {
  if (data.length === 0) {
    return (
      <div className="mt-5 flex h-[280px] items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-400">
        월별 누적 데이터가 없습니다.
      </div>
    );
  }

  if (data.length === 1) {
    const item = data[0];

    return (
      <div className="mt-5 grid h-[280px] place-items-center rounded-xl bg-zinc-50">
        <div className="text-center">
          <p className="text-sm font-semibold text-zinc-500">
            {formatMonth(item.month)}
          </p>

          <div className="mt-4 flex gap-8">
            <div>
              <p className="text-3xl font-bold text-blue-600">
                {item.applications.toLocaleString(
                  "ko-KR"
                )}
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                신청
              </p>
            </div>

            <div>
              <p className="text-3xl font-bold text-violet-600">
                {item.reservations.toLocaleString(
                  "ko-KR"
                )}
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                예약
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const width = 800;
  const height = 270;
  const left = 45;
  const right = 20;
  const top = 20;
  const bottom = 40;

  const chartWidth =
    width - left - right;

  const chartHeight =
    height - top - bottom;

  const maxValue = Math.max(
    ...data.flatMap((item) => [
      item.applications,
      item.reservations,
    ]),
    1
  );

  const roundedMax =
    Math.ceil(maxValue / 100) *
    100;

  const getX = (
    index: number
  ) =>
    left +
    (index /
      (data.length - 1)) *
      chartWidth;

  const getY = (
    value: number
  ) =>
    top +
    chartHeight -
    (value / roundedMax) *
      chartHeight;

  const applicationPoints =
    data
      .map(
        (item, index) =>
          `${getX(
            index
          )},${getY(
            item.applications
          )}`
      )
      .join(" ");

  const reservationPoints =
    data
      .map(
        (item, index) =>
          `${getX(
            index
          )},${getY(
            item.reservations
          )}`
      )
      .join(" ");

  const ticks = [
    0,
    0.25,
    0.5,
    0.75,
    1,
  ].map((ratio) =>
    Math.round(
      roundedMax * ratio
    )
  );

  return (
    <div className="mt-5 w-full overflow-hidden">
      <div className="mb-4 flex gap-5 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="h-[3px] w-5 bg-blue-600" />
          신청
        </div>

        <div className="flex items-center gap-2">
          <span className="h-[3px] w-5 bg-violet-500" />
          예약
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[280px] w-full"
        preserveAspectRatio="none"
      >
        {ticks.map((tick) => {
          const y =
            getY(tick);

          return (
            <g key={tick}>
              <line
                x1={left}
                y1={y}
                x2={
                  width - right
                }
                y2={y}
                stroke="#e4e4e7"
                strokeWidth="1"
              />

              <text
                x={left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#71717a"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={
            applicationPoints
          }
        />

        <polyline
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={
            reservationPoints
          }
        />

        {data.map(
          (item, index) => (
            <g key={item.month}>
              <circle
                cx={getX(
                  index
                )}
                cy={getY(
                  item.applications
                )}
                r="5"
                fill="#2563eb"
              />

              <circle
                cx={getX(
                  index
                )}
                cy={getY(
                  item.reservations
                )}
                r="5"
                fill="#8b5cf6"
              />

              <text
                x={getX(
                  index
                )}
                y={
                  height - 10
                }
                textAnchor="middle"
                fontSize="12"
                fill="#71717a"
              >
                {formatShortMonth(
                  item.month
                )}
              </text>
            </g>
          )
        )}
      </svg>
    </div>
  );
}

function PlatformChart({
  current,
  previous,
  lastYear,
}: {
  current: PlatformStat[];
  previous: PlatformStat[];
  lastYear: PlatformStat[];
}) {
  const platformNames = Array.from(
    new Set([
      ...current.map((item) => item.name),
      ...previous.map((item) => item.name),
      ...lastYear.map((item) => item.name),
    ])
  );

  if (platformNames.length === 0) {
    return (
      <div className="mt-7 flex h-[250px] items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-400">
        플랫폼 데이터가 없습니다.
      </div>
    );
  }

  const getStat = (
    rows: PlatformStat[],
    name: string
  ) =>
    rows.find(
      (item) => item.name === name
    );

  const periods = [
    {
      label: "이번 달",
      rows: current,
      barClass: "bg-blue-600",
      textClass: "text-blue-700",
    },
    {
      label: "전월",
      rows: previous,
      barClass: "bg-zinc-400",
      textClass: "text-zinc-700",
    },
    {
      label: "전년 동월",
      rows: lastYear,
      barClass: "bg-violet-300",
      textClass: "text-violet-700",
    },
  ];

  return (
    <div className="mt-7 grid gap-5 md:grid-cols-2">
      {platformNames.map((name) => (
        <div
          key={name}
          className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4"
        >
          <h3 className="mb-4 font-black text-zinc-900">
            {name}
          </h3>

          <div className="space-y-3">
            {periods.map((period) => {
              const stat =
                getStat(
                  period.rows,
                  name
                );

              const rate =
                stat?.rate ?? 0;

              const hasData =
                Boolean(stat);

              return (
                <div
                  key={period.label}
                  className="grid grid-cols-[64px_1fr_64px] items-center gap-3"
                >
                  <span className="text-xs font-semibold text-zinc-500">
                    {period.label}
                  </span>

                  <div className="h-6 overflow-hidden rounded-md bg-zinc-100">
                    {hasData && (
                      <div
                        className={`h-full rounded-md ${period.barClass}`}
                        style={{
                          width: `${Math.min(
                            Math.max(
                              rate,
                              rate > 0 ? 1 : 0
                            ),
                            100
                          )}%`,
                        }}
                      />
                    )}
                  </div>

                  <span
                    className={`text-right text-xs font-black ${period.textClass}`}
                  >
                    {hasData
                      ? `${rate.toFixed(2)}%`
                      : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
export default function DashboardClient({
  data,
  availableMonths,
}: {
  data: DashboardData;
  availableMonths: string[];
}) {
  const [selectedCategoryTrend, setSelectedCategoryTrend] =
    useState("코");

  const [
    dashboardData,
    setDashboardData,
  ] = useState<DashboardData>(
    data
  );

  const [
    changingMonth,
    setChangingMonth,
  ] = useState(false);

  /*
    월간 / 일별 보기
  */
  const [
    viewMode,
    setViewMode,
  ] = useState<
    "monthly" | "daily"
  >("monthly");

  const current =
    dashboardData.current;

  async function changeMonth(
    month: string
  ) {
    if (
      changingMonth ||
      month ===
        dashboardData.selectedMonth
    ) {
      return;
    }

    setChangingMonth(true);

    try {
      const response =
        await fetch(
          `/api/dashboard?month=${encodeURIComponent(
            month
          )}`,
          {
            cache: "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "조회 실패"
        );
      }

      setDashboardData(
        result.data
      );

      window.history.replaceState(
        null,
        "",
        `/?month=${encodeURIComponent(
          month
        )}`
      );
    } catch (error) {
      console.error(error);

      alert(
        "월 데이터를 불러오지 못했습니다."
      );
    } finally {
      setChangingMonth(false);
    }
  }

  if (!current) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] p-10">
        <div className="mx-auto max-w-[1000px] rounded-2xl bg-white p-10 text-center">
          데이터가 없습니다.
        </div>
      </main>
    );
  }

  const previous =
    dashboardData.previous;

  const lastYear =
    dashboardData.lastYear;

  const kpis = [
    {
      title: "총 신청",

      value:
        formatInteger(
          current.totalApplications
        ),

      previousValue:
        formatInteger(
          previous?.totalApplications
        ),

      lastYearValue:
        formatInteger(
          lastYear?.totalApplications
        ),

      mom: calculateChange(
        current.totalApplications,
        previous?.totalApplications
      ),

      yoy: calculateChange(
        current.totalApplications,
        lastYear?.totalApplications
      ),

      unit: "%" as const,
    },

    {
      title: "총 예약",

      value:
        formatInteger(
          current.totalReservations
        ),

      previousValue:
        formatInteger(
          previous?.totalReservations
        ),

      lastYearValue:
        formatInteger(
          lastYear?.totalReservations
        ),

      mom: calculateChange(
        current.totalReservations,
        previous?.totalReservations
      ),

      yoy: calculateChange(
        current.totalReservations,
        lastYear?.totalReservations
      ),

      unit: "%" as const,
    },

    {
      title:
        "예약 전환율",

      value:
        formatPercent(
          current.reservationRate
        ),

      previousValue:
        formatPercent(
          previous?.reservationRate
        ),

      lastYearValue:
        formatPercent(
          lastYear?.reservationRate
        ),

      mom:
        calculatePointChange(
          current.reservationRate,
          previous?.reservationRate
        ),

      yoy:
        calculatePointChange(
          current.reservationRate,
          lastYear?.reservationRate
        ),

      unit: "%p" as const,
    },

    {
      title: "총 상담",

      value:
        formatInteger(
          current.consultations
        ),

      previousValue:
        formatInteger(
          previous?.consultations
        ),

      lastYearValue:
        formatInteger(
          lastYear?.consultations
        ),

      mom: calculateChange(
        current.consultations,
        previous?.consultations
      ),

      yoy: calculateChange(
        current.consultations,
        lastYear?.consultations
      ),

      unit: "%" as const,
    },

    {
      title: "수술 전환",

      value:
        formatInteger(
          current.surgeries
        ),

      previousValue:
        formatInteger(
          previous?.surgeries
        ),

      lastYearValue:
        formatInteger(
          lastYear?.surgeries
        ),

      mom: calculateChange(
        current.surgeries,
        previous?.surgeries
      ),

      yoy: calculateChange(
        current.surgeries,
        lastYear?.surgeries
      ),

      unit: "%" as const,
    },

    {
      title:
        "상담 → 수술 전환율",

      value:
        formatPercent(
          current.surgeryRate
        ),

      previousValue:
        formatPercent(
          previous?.surgeryRate
        ),

      lastYearValue:
        formatPercent(
          lastYear?.surgeryRate
        ),

      mom:
        calculatePointChange(
          current.surgeryRate,
          previous?.surgeryRate
        ),

      yoy:
        calculatePointChange(
          current.surgeryRate,
          lastYear?.surgeryRate
        ),

      unit: "%p" as const,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
        {/* HEADER */}

        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <p className="mb-1 text-sm font-semibold text-blue-600">
              MIHO PERFORMANCE
            </p>

            <h1 className="text-3xl font-bold">
              미호성형외과 실적 대시보드
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              예약 · 상담 · 수술 전환 현황을 한눈에 확인합니다.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
              <span className="font-semibold text-zinc-400">
                색상 기준
              </span>

              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                현재 / 핵심
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
                전년 동월
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
                전월
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                개선
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                하락
              </div>
            </div>
          </div>

          {/* 관리자 바로가기 */}
          <a
            href="/login"
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Settings size={17} />
            관리자
          </a>

          {/* 월 선택 */}

          <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
            <CalendarDays
              size={17}
              className="text-blue-600"
            />

            <select
              value={
                dashboardData.selectedMonth
              }
              disabled={
                changingMonth
              }
              onChange={(event) =>
                void changeMonth(
                  event.target.value
                )
              }
              className="cursor-pointer bg-transparent text-sm font-semibold outline-none disabled:cursor-wait"
            >
              {availableMonths.map(
                (month) => (
                  <option
                    key={month}
                    value={month}
                  >
                    {formatMonth(
                      month
                    )}
                  </option>
                )
              )}
            </select>

            {changingMonth && (
              <Loader2
                size={16}
                className="animate-spin text-blue-600"
              />
            )}
          </div>
        </header>

        {/* 월간 / 일별 탭 */}

        <div className="mb-6 flex w-fit rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() =>
              setViewMode(
                "monthly"
              )
            }
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition ${
              viewMode ===
              "monthly"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
            }`}
          >
            월간 보기
          </button>

          <button
            type="button"
            onClick={() =>
              setViewMode(
                "daily"
              )
            }
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition ${
              viewMode ===
              "daily"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
            }`}
          >
            일별 보기
          </button>
        </div>

        {/* =========================
            월간 대시보드
        ========================= */}

        {viewMode ===
        "monthly" ? (
          <>
            {/* 핵심 비교 / 전환율 */}

            <section className="mb-6 grid gap-6 xl:grid-cols-2">
              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">
                  핵심 실적 비교
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  이번 달 · 전월 · 전년 동월
                </p>

                <VolumeChart
                  current={
                    current
                  }
                  previous={
                    previous
                  }
                  lastYear={
                    lastYear
                  }
                />
              </article>

              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">
                  전환율 비교
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  예약 전환율과 상담 → 수술 전환율
                </p>

                <ConversionChart
                  current={
                    current
                  }
                  previous={
                    previous
                  }
                  lastYear={
                    lastYear
                  }
                />
              </article>
            </section>

            {/* KPI */}

            <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {kpis.map(
                (kpi) => (
                  <article
                    key={
                      kpi.title
                    }
                    className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                  >
                    <div className="mb-5 flex items-start justify-between">
                      <div>
                        <p className="text-sm text-zinc-500">
                          {
                            kpi.title
                          }
                        </p>

                        <p className="mt-2 text-3xl font-bold">
                          {
                            kpi.value
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                        <TrendingUp
                          size={
                            19
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                      <div className="flex justify-between">
                        <div className="flex gap-2">
                          <span className="text-sm text-zinc-500">
                            전월
                          </span>

                          <strong className="text-sm">
                            {
                              kpi.previousValue
                            }
                          </strong>
                        </div>

                        <ChangeBadge
                          value={
                            kpi.mom
                          }
                          unit={
                            kpi.unit
                          }
                        />
                      </div>

                      <div className="flex justify-between">
                        <div className="flex gap-2">
                          <span className="text-sm text-zinc-500">
                            전년 동월
                          </span>

                          <strong className="text-sm text-violet-700">
                            {
                              kpi.lastYearValue
                            }
                          </strong>
                        </div>

                        <ChangeBadge
                          value={
                            kpi.yoy
                          }
                          unit={
                            kpi.unit
                          }
                        />
                      </div>
                    </div>
                  </article>
                )
              )}
            </section>

            {/* 월별 추이 / 플랫폼 */}

            <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">
                  월별 신청 · 예약 추이
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  선택한 월 기준 최근 12개월
                </p>

                <TrendChart
                  data={
                    dashboardData.monthlyTrend
                  }
                />

                {(() => {
                  const rows =
                    dashboardData.dailyConversions ?? [];

                  const totalConsultations =
                    rows.reduce(
                      (sum, row) =>
                        sum + row.consultations,
                      0
                    );

                  const totalSurgeries =
                    rows.reduce(
                      (sum, row) =>
                        sum + row.surgeries,
                      0
                    );

                  const totalRate =
                    totalConsultations > 0
                      ? (totalSurgeries /
                          totalConsultations) *
                        100
                      : 0;

                  return (
                    <div className="mt-8 border-t border-zinc-100 pt-6">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h3 className="font-black text-zinc-900">
                            일별 상담 · 수술 현황
                          </h3>

                          <p className="mt-1 text-xs text-zinc-500">
                            선택 월 기준 상담량 대비 수술량
                          </p>
                        </div>

                        <a
                          href="/admin/conversion"
                          className="text-xs font-bold text-blue-600 hover:text-blue-700"
                        >
                          입력하기 →
                        </a>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-zinc-50 px-4 py-4">
                          <p className="text-xs font-semibold text-zinc-500">
                            월 상담
                          </p>

                          <p className="mt-1 text-2xl font-black text-zinc-900">
                            {totalConsultations.toLocaleString()}
                            <span className="ml-1 text-sm text-zinc-400">
                              건
                            </span>
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-50 px-4 py-4">
                          <p className="text-xs font-semibold text-zinc-500">
                            월 수술
                          </p>

                          <p className="mt-1 text-2xl font-black text-zinc-900">
                            {totalSurgeries.toLocaleString()}
                            <span className="ml-1 text-sm text-zinc-400">
                              건
                            </span>
                          </p>
                        </div>

                        <div className="rounded-xl bg-blue-50 px-4 py-4">
                          <p className="text-xs font-semibold text-blue-600">
                            상담 대비 수술 비율
                          </p>

                          <p className="mt-1 text-2xl font-black text-blue-700">
                            {totalRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {rows.length > 0 ? (
                        <div className="mt-5 max-h-[330px] overflow-auto rounded-xl border border-zinc-100">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500">
                              <tr>
                                <th className="px-4 py-3 text-left font-bold">
                                  날짜
                                </th>

                                <th className="px-4 py-3 text-right font-bold">
                                  상담
                                </th>

                                <th className="px-4 py-3 text-right font-bold">
                                  수술
                                </th>

                                <th className="px-4 py-3 text-right font-bold">
                                  비율
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {rows
                                .slice()
                                .sort(
                                  (a, b) =>
                                    b.date.localeCompare(
                                      a.date
                                    )
                                )
                                .map((row) => (
                                  <tr
                                    key={row.date}
                                    className="border-t border-zinc-100"
                                  >
                                    <td className="px-4 py-3 font-semibold text-zinc-700">
                                      {`${Number(
                                        row.date.slice(5, 7)
                                      )}/${Number(
                                        row.date.slice(8, 10)
                                      )}`}
                                    </td>

                                    <td className="px-4 py-3 text-right font-bold text-zinc-800">
                                      {row.consultations}
                                    </td>

                                    <td className="px-4 py-3 text-right font-bold text-zinc-800">
                                      {row.surgeries}
                                    </td>

                                    <td className="px-4 py-3 text-right font-black text-blue-700">
                                      {row.rate.toFixed(1)}%
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-5 rounded-xl bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-400">
                          아직 입력된 상담·수술 데이터가 없습니다.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </article>
            

              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">
                      월별 내원 경로
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      선택 월 실제 내원 기준
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-zinc-400">
                      총 내원
                    </p>
                    <p className="mt-1 text-2xl font-black text-zinc-950">
                      {dashboardData.totalVisitSourceCount.toLocaleString()}
                      <span className="ml-1 text-sm font-semibold text-zinc-400">
                        명
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {dashboardData.monthlyVisitSources.length > 0 ? (
                    dashboardData.monthlyVisitSources.map((row) => {
                      const rate =
                        dashboardData.totalVisitSourceCount > 0
                          ? (row.count /
                              dashboardData.totalVisitSourceCount) *
                            100
                          : 0;

                      return (
                        <div key={row.source}>
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold text-zinc-700">
                              {row.source}
                            </span>

                            <span className="whitespace-nowrap text-zinc-500">
                              <strong className="text-zinc-900">
                                {row.count.toLocaleString()}명
                              </strong>
                              {" · "}
                              {rate.toFixed(1)}%
                            </span>
                          </div>

                          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${Math.max(
                                  rate,
                                  rate > 0 ? 2 : 0
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex min-h-[220px] items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-400">
                      등록된 내원 경로 데이터가 없습니다.
                    </div>
                  )}
                </div>
              </article>
            </section>
<section className="mt-6">
              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">
                      카테고리별 상담 · 수술
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                      선택 월 기준 · 코 / 눈 / 리프팅 / 쁘띠
                    </p>
                  </div>

                  <a
                    href="/admin/category-conversion"
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    입력하기 →
                  </a>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {(dashboardData.categoryConversions ?? []).map(
                    (row) => (
                      <div
                        key={row.category}
                        className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-zinc-900">
                            {row.category}
                          </h3>

                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                            {row.rate.toFixed(1)}%
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold text-zinc-500">
                              상담
                            </p>

                            <p className="mt-1 text-xl font-black text-zinc-900">
                              {row.consultations.toLocaleString()}
                              <span className="ml-1 text-xs font-semibold text-zinc-400">
                                건
                              </span>
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs font-semibold text-zinc-500">
                              수술
                            </p>

                            <p className="mt-1 text-xl font-black text-zinc-900">
                              {row.surgeries.toLocaleString()}
                              <span className="ml-1 text-xs font-semibold text-zinc-400">
                                건
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="mb-2 flex justify-between text-xs">
                            <span className="font-semibold text-zinc-500">
                              상담 대비 수술
                            </span>

                            <strong className="text-blue-700">
                              {row.rate.toFixed(1)}%
                            </strong>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${Math.min(
                                  row.rate,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </article>
            </section>
            {/* CATEGORY_DAILY_TREND_SECTION */}
            <section className="mt-6">
              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-zinc-900">
                      카테고리 일별 추이
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                      선택 월 기준 일자별 상담 · 수술 변화
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {["코", "눈", "리프팅", "쁘띠"].map(
                      (category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() =>
                            setSelectedCategoryTrend(
                              category
                            )
                          }
                          className={
                            selectedCategoryTrend ===
                            category
                              ? "rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white"
                              : "rounded-xl bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-200"
                          }
                        >
                          {category}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {(() => {
                  const rows =
                    (
                      dashboardData.dailyCategoryConversions ??
                      []
                    ).filter(
                      (row) =>
                        row.category ===
                        selectedCategoryTrend
                    );

                  const consultations =
                    rows.reduce(
                      (sum, row) =>
                        sum +
                        row.consultations,
                      0
                    );

                  const surgeries =
                    rows.reduce(
                      (sum, row) =>
                        sum +
                        row.surgeries,
                      0
                    );

                  const rate =
                    consultations > 0
                      ? (surgeries /
                          consultations) *
                        100
                      : 0;

                  return (
                    <>
                      <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-zinc-50 px-4 py-4">
                          <p className="text-xs font-semibold text-zinc-500">
                            {selectedCategoryTrend} 상담
                          </p>

                          <p className="mt-1 text-2xl font-black text-zinc-900">
                            {consultations.toLocaleString()}
                            <span className="ml-1 text-sm font-semibold text-zinc-400">
                              건
                            </span>
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-50 px-4 py-4">
                          <p className="text-xs font-semibold text-zinc-500">
                            {selectedCategoryTrend} 수술
                          </p>

                          <p className="mt-1 text-2xl font-black text-zinc-900">
                            {surgeries.toLocaleString()}
                            <span className="ml-1 text-sm font-semibold text-zinc-400">
                              건
                            </span>
                          </p>
                        </div>

                        <div className="rounded-xl bg-blue-50 px-4 py-4">
                          <p className="text-xs font-semibold text-blue-600">
                            상담 대비 수술 비율
                          </p>

                          <p className="mt-1 text-2xl font-black text-blue-700">
                            {rate.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-7">
                        <CategoryTrendChart
                          rows={rows}
                        />
                      </div>
                    </>
                  );
                })()}
              </article>
            </section>


            <section className="mt-6">
              <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">
                  플랫폼별 예약 전환율 비교
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  이번 달 · 전월 · 전년 동월 기준
                </p>

                <PlatformChart
                  current={current.platformStats}
                  previous={previous?.platformStats ?? []}
                  lastYear={lastYear?.platformStats ?? []}
                />
              </article>
            </section>
          </>
        ) : (
          /* =========================
             일별 대시보드
          ========================= */

          <DailyDashboard
            month={
              dashboardData.selectedMonth
            }
          />
        )}
      </div>
    </main>
  );
}


