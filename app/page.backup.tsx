"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  TrendingUp,
} from "lucide-react";

const kpis = [
  {
    title: "총 신청",
    value: "782",
    previousValue: "790",
    lastYearValue: "721",
    mom: -1.0,
    yoy: 8.5,
    unit: "%",
  },
  {
    title: "총 예약",
    value: "503",
    previousValue: "487",
    lastYearValue: "460",
    mom: 3.3,
    yoy: 9.3,
    unit: "%",
  },
  {
    title: "예약 전환율",
    value: "64.32%",
    previousValue: "61.65%",
    lastYearValue: "63.80%",
    mom: 2.67,
    yoy: 0.52,
    unit: "%p",
  },
  {
    title: "총 상담",
    value: "364",
    previousValue: "356",
    lastYearValue: "330",
    mom: 2.2,
    yoy: 10.3,
    unit: "%",
  },
  {
    title: "수술 전환",
    value: "115",
    previousValue: "100",
    lastYearValue: "91",
    mom: 15.0,
    yoy: 26.4,
    unit: "%",
  },
  {
    title: "상담 → 수술 전환율",
    value: "31.59%",
    previousValue: "28.09%",
    lastYearValue: "27.60%",
    mom: 3.5,
    yoy: 3.99,
    unit: "%p",
  },
];

const volumeComparison = [
  { name: "총 신청", current: 782, previous: 790, lastYear: 721 },
  { name: "총 예약", current: 503, previous: 487, lastYear: 460 },
  { name: "총 상담", current: 364, previous: 356, lastYear: 330 },
  { name: "수술 전환", current: 115, previous: 100, lastYear: 91 },
];

const conversionComparison = [
  {
    name: "예약 전환율",
    current: 64.32,
    previous: 61.65,
    lastYear: 63.8,
  },
  {
    name: "상담 → 수술",
    current: 31.59,
    previous: 28.09,
    lastYear: 27.6,
  },
];

const platformData = [
  { name: "네이버", rate: 80.65 },
  { name: "플러스친구", rate: 63.93 },
  { name: "강남언니", rate: 52.94 },
  { name: "홈페이지", rate: 50.46 },
  { name: "바비톡", rate: 44.44 },
  { name: "CPA", rate: 9.16 },
];

const monthlyTrend = [
  { month: "1월", apply: 650, reserve: 412 },
  { month: "2월", apply: 682, reserve: 431 },
  { month: "3월", apply: 705, reserve: 458 },
  { month: "4월", apply: 731, reserve: 470 },
  { month: "5월", apply: 744, reserve: 482 },
  { month: "6월", apply: 790, reserve: 487 },
  { month: "7월", apply: 782, reserve: 503 },
];

function ChangeBadge({
  value,
  unit,
}: {
  value: number;
  unit: string;
}) {
  const positive = value >= 0;

  return (
    <span
      className={`flex items-center gap-1 text-sm font-bold ${
        positive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {positive ? (
        <ArrowUpRight size={14} />
      ) : (
        <ArrowDownRight size={14} />
      )}

      {positive ? "+" : ""}
      {value.toFixed(unit === "%p" ? 2 : 1)}
      {unit}
    </span>
  );
}

function VolumeChart() {
  const max = 850;

  return (
    <div className="mt-5">
      <div className="mb-5 flex flex-wrap gap-5 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-blue-600" />
          이번 달
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-zinc-400" />
          전월
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-violet-300" />
          전년 동월
        </div>
      </div>

      <div className="flex h-[280px] items-end gap-6 border-b border-zinc-200 px-4">
        {volumeComparison.map((item) => (
          <div
            key={item.name}
            className="flex h-full flex-1 flex-col justify-end"
          >
            <div className="flex flex-1 items-end justify-center gap-2">
              <div className="flex w-[28%] flex-col items-center justify-end">
                <span className="mb-1 text-xs font-semibold text-blue-700">
                  {item.current}
                </span>

                <div
                  className="w-full rounded-t-md bg-blue-600"
                  style={{
                    height: `${(item.current / max) * 210}px`,
                    minHeight: "8px",
                  }}
                />
              </div>

              <div className="flex w-[28%] flex-col items-center justify-end">
                <span className="mb-1 text-xs font-semibold text-zinc-600">
                  {item.previous}
                </span>

                <div
                  className="w-full rounded-t-md bg-zinc-400"
                  style={{
                    height: `${(item.previous / max) * 210}px`,
                    minHeight: "8px",
                  }}
                />
              </div>

              <div className="flex w-[28%] flex-col items-center justify-end">
                <span className="mb-1 text-xs font-semibold text-violet-700">
                  {item.lastYear}
                </span>

                <div
                  className="w-full rounded-t-md bg-violet-300"
                  style={{
                    height: `${(item.lastYear / max) * 210}px`,
                    minHeight: "8px",
                  }}
                />
              </div>
            </div>

            <div className="mt-3 h-10 text-center text-sm font-semibold">
              {item.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConversionChart() {
  return (
    <div className="mt-5">
      <div className="mb-5 flex flex-wrap gap-5 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-blue-600" />
          이번 달
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-zinc-400" />
          전월
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-violet-300" />
          전년 동월
        </div>
      </div>

      <div className="space-y-7">
        {conversionComparison.map((item) => (
          <div key={item.name}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold">{item.name}</span>
              <span className="text-xs text-zinc-400">0 ~ 100%</span>
            </div>

            <div className="space-y-2">
              <RateBar
                label="이번 달"
                value={item.current}
                barClass="bg-blue-600"
                valueClass="text-blue-700"
              />

              <RateBar
                label="전월"
                value={item.previous}
                barClass="bg-zinc-400"
                valueClass="text-zinc-600"
              />

              <RateBar
                label="전년 동월"
                value={item.lastYear}
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

function RateBar({
  label,
  value,
  barClass,
  valueClass,
}: {
  label: string;
  value: number;
  barClass: string;
  valueClass: string;
}) {
  return (
    <div className="grid grid-cols-[70px_1fr_60px] items-center gap-3">
      <span className="text-xs text-zinc-500">{label}</span>

      <div className="h-7 overflow-hidden rounded-md bg-zinc-100">
        <div
          className={`h-full rounded-md ${barClass}`}
          style={{ width: `${value}%` }}
        />
      </div>

      <span className={`text-right text-xs font-bold ${valueClass}`}>
        {value.toFixed(2)}%
      </span>
    </div>
  );
}

function TrendChart() {
  const width = 800;
  const height = 270;
  const left = 45;
  const right = 20;
  const top = 20;
  const bottom = 40;

  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = 850;

  const getX = (index: number) =>
    left + (index / (monthlyTrend.length - 1)) * chartWidth;

  const getY = (value: number) =>
    top + chartHeight - (value / max) * chartHeight;

  const applyPoints = monthlyTrend
    .map((d, i) => `${getX(i)},${getY(d.apply)}`)
    .join(" ");

  const reservePoints = monthlyTrend
    .map((d, i) => `${getX(i)},${getY(d.reserve)}`)
    .join(" ");

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
        {[0, 200, 400, 600, 800].map((tick) => {
          const y = getY(tick);

          return (
            <g key={tick}>
              <line
                x1={left}
                y1={y}
                x2={width - right}
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
          points={applyPoints}
        />

        <polyline
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={reservePoints}
        />

        {monthlyTrend.map((item, index) => (
          <g key={item.month}>
            <circle
              cx={getX(index)}
              cy={getY(item.apply)}
              r="5"
              fill="#2563eb"
            />

            <circle
              cx={getX(index)}
              cy={getY(item.reserve)}
              r="5"
              fill="#8b5cf6"
            />

            <text
              x={getX(index)}
              y={height - 10}
              textAnchor="middle"
              fontSize="12"
              fill="#71717a"
            >
              {item.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PlatformChart() {
  return (
    <div className="mt-7 space-y-5">
      {platformData.map((item, index) => (
        <div
          key={item.name}
          className="grid grid-cols-[95px_1fr_65px] items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="w-4 text-xs font-semibold text-zinc-400">
              {index + 1}
            </span>

            <span className="text-sm font-semibold">{item.name}</span>
          </div>

          <div className="h-7 overflow-hidden rounded-md bg-blue-50">
            <div
              className="h-full rounded-md bg-blue-600"
              style={{ width: `${item.rate}%` }}
            />
          </div>

          <span className="text-right text-sm font-bold text-blue-700">
            {item.rate.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="mb-1 text-sm font-semibold text-blue-600">
              MIHO PERFORMANCE
            </p>

            <h1 className="text-3xl font-bold tracking-tight">
              미호성형외과 실적 대시보드
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              예약 · 상담 · 수술 전환 현황을 한눈에 확인합니다.
            </p>
          </div>
<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
  <span className="font-semibold text-zinc-400">색상 기준</span>

  <div className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
    <span>현재 / 핵심</span>
  </div>

  <div className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
    <span>비교값</span>
  </div>

  <div className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
    <span>과거 기준</span>
  </div>

  <div className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
    <span>개선</span>
  </div>

  <div className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
    <span>하락</span>
  </div>
</div>
          <button className="flex w-fit items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold shadow-sm">
            <CalendarDays size={17} className="text-blue-600" />
            2026년 7월
          </button>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map((kpi) => (
            <article
              key={kpi.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-500">
                    {kpi.title}
                  </p>

                  <p className="mt-2 text-3xl font-bold tracking-tight">
                    {kpi.value}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <TrendingUp size={19} />
                </div>
              </div>

              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">전월</span>
                    <span className="text-sm font-bold text-zinc-700">
                      {kpi.previousValue}
                    </span>
                  </div>

                  <ChangeBadge value={kpi.mom} unit={kpi.unit} />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">
                      전년 동월
                    </span>
                    <span className="text-sm font-bold text-violet-700">
                      {kpi.lastYearValue}
                    </span>
                  </div>

                  <ChangeBadge value={kpi.yoy} unit={kpi.unit} />
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">핵심 실적 비교</h2>
            <p className="mt-1 text-sm text-zinc-500">
              이번 달 · 전월 · 전년 동월
            </p>
            <VolumeChart />
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">전환율 비교</h2>
            <p className="mt-1 text-sm text-zinc-500">
              예약 전환율과 상담 → 수술 전환율
            </p>
            <ConversionChart />
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">월별 신청 · 예약 추이</h2>
            <p className="mt-1 text-sm text-zinc-500">
              최근 월별 전체 유입 및 예약 흐름
            </p>
            <TrendChart />
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">플랫폼별 예약 전환율</h2>
            <p className="mt-1 text-sm text-zinc-500">
              2026년 7월 기준
            </p>
            <PlatformChart />
          </article>
        </section>
      </div>
    </main>
  );
}
