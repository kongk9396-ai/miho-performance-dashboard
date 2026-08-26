"use client";

import {
  useMemo,
  useState,
} from "react";

type PlatformRow = {
  platform: string;
  applications: number;
  reservations: number;
  raw?: string;
};

type CallStats = {
  total: number;
  details: Record<string, number>;
  raw: string;
};

type VisitSource = {
  source: string;
  count: number;
};

type IncallStats = {
  total: number;
  newCount: number;
  simpleCount: number;
  changedCount: number;
  canceledCount: number;
};

type WarningRow = {
  line: string;
  reason: string;
};

type ParsedDay = {
  date: string;

  rawText: string;

  platforms: PlatformRow[];

  previousCall: CallStats;
  sevenCall: CallStats;

  visitSources: VisitSource[];

  incall: IncallStats;

  cancellations: string[];

  warnings: WarningRow[];
};

type PreviewResponse = {
  ok: boolean;

  message?: string;

  days?: ParsedDay[];

  summary?: {
    days: number;
    platformRows: number;
    visitSources: number;
    cancellations: number;
    warnings: number;
  };
};

type CommitResponse = {
  ok: boolean;

  message?: string;

  saved?: {
    reports: number;
    platforms: number;
    calls: number;
    visitSources: number;
    incalls: number;
    cancellations: number;
  };

  rebuiltMonths?: string[];
};

function formatDate(
  date: string
) {
  const [
    year,
    month,
    day,
  ] = date
    .split("-")
    .map(Number);

  return `${year}년 ${month}월 ${day}일`;
}

function getTotalApplications(
  day: ParsedDay
) {
  return day.platforms.reduce(
    (sum, row) =>
      sum + row.applications,
    0
  );
}

function getTotalReservations(
  day: ParsedDay
) {
  return day.platforms.reduce(
    (sum, row) =>
      sum + row.reservations,
    0
  );
}

function formatPercent(
  value: number
) {
  if (!Number.isFinite(value)) {
    return "0.0%";
  }

  return `${value.toFixed(1)}%`;
}

function CallDetails({
  title,
  data,
}: {
  title: string;
  data: CallStats;
}) {
  const entries =
    Object.entries(
      data.details ?? {}
    );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-bold text-zinc-900">
          {title}
        </div>

        <div className="text-lg font-black text-zinc-900">
          총 {data.total}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {entries.map(
            ([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-zinc-100 px-3 py-2 text-sm"
              >
                <span className="text-zinc-500">
                  {label}
                </span>{" "}
                <strong className="text-zinc-900">
                  {value}
                </strong>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="text-sm text-zinc-400">
          상세 데이터 없음
        </div>
      )}
    </div>
  );
}

function DayPreview({
  day,
}: {
  day: ParsedDay;
}) {
  const applications =
    getTotalApplications(day);

  const reservations =
    getTotalReservations(day);

  const conversionRate =
    applications > 0
      ? (reservations /
          applications) *
        100
      : 0;

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      {/* 날짜 헤더 */}

      <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xl font-black text-zinc-950">
              {formatDate(
                day.date
              )}
            </div>

            <div className="mt-1 text-sm text-zinc-500">
              DB보고 자동 분석 결과
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* 예약 먼저 */}

            <div className="rounded-xl bg-violet-50 px-4 py-2">
              <span className="text-sm text-violet-600">
                예약
              </span>{" "}
              <strong className="text-violet-700">
                {reservations}
              </strong>
            </div>

            {/* 신청 다음 */}

            <div className="rounded-xl bg-blue-50 px-4 py-2">
              <span className="text-sm text-blue-600">
                신청
              </span>{" "}
              <strong className="text-blue-700">
                {applications}
              </strong>
            </div>

            <div className="rounded-xl bg-emerald-50 px-4 py-2">
              <span className="text-sm text-emerald-600">
                전환율
              </span>{" "}
              <strong className="text-emerald-700">
                {formatPercent(
                  conversionRate
                )}
              </strong>
            </div>

            <div className="rounded-xl bg-zinc-100 px-4 py-2">
              <span className="text-sm text-zinc-500">
                총인콜
              </span>{" "}
              <strong>
                {day.incall.total}
              </strong>
            </div>

            <div className="rounded-xl bg-red-50 px-4 py-2">
              <span className="text-sm text-red-500">
                당취
              </span>{" "}
              <strong className="text-red-600">
                {
                  day.cancellations
                    .length
                }
                건
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* DB 보고 */}

        <section>
          <h3 className="mb-3 text-sm font-black text-zinc-900">
            DB 보고내역
          </h3>

          {day.platforms.length >
          0 ? (
            <div className="overflow-hidden rounded-2xl border border-zinc-200">
              {/* 예약 → 신청 */}

              <div className="grid grid-cols-[1fr_100px_100px] bg-zinc-50 px-4 py-3 text-xs font-bold text-zinc-500">
                <div>
                  플랫폼
                </div>

                <div className="text-right">
                  예약
                </div>

                <div className="text-right">
                  신청
                </div>
              </div>

              {day.platforms.map(
                (row) => (
                  <div
                    key={
                      row.platform
                    }
                    className="grid grid-cols-[1fr_100px_100px] border-t border-zinc-100 px-4 py-3 text-sm"
                  >
                    <div className="font-bold text-zinc-800">
                      {
                        row.platform
                      }
                    </div>

                    {/* 예약 */}

                    <div className="text-right font-bold text-violet-600">
                      {
                        row.reservations
                      }
                    </div>

                    {/* 신청 */}

                    <div className="text-right font-bold text-blue-600">
                      {
                        row.applications
                      }
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-400">
              플랫폼 데이터 없음
            </div>
          )}
        </section>

        {/* 콜 */}

        <section className="grid gap-4 lg:grid-cols-2">
          <CallDetails
            title="전날콜"
            data={
              day.previousCall
            }
          />

          <CallDetails
            title="7콜"
            data={day.sevenCall}
          />
        </section>

        {/* 총인콜 */}

        <section>
          <h3 className="mb-3 text-sm font-black text-zinc-900">
            총인콜
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              [
                "총",
                day.incall.total,
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
              ([label, value]) => (
                <div
                  key={String(
                    label
                  )}
                  className="rounded-2xl bg-zinc-50 p-4 text-center"
                >
                  <div className="text-xs font-medium text-zinc-500">
                    {label}
                  </div>

                  <div className="mt-1 text-xl font-black text-zinc-900">
                    {value}
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {/* 내원경로 */}

        <section>
          <h3 className="mb-3 text-sm font-black text-zinc-900">
            내원경로
          </h3>

          {day.visitSources
            .length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {day.visitSources.map(
                (
                  source,
                  index
                ) => (
                  <div
                    key={`${source.source}-${index}`}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-600">
                      {
                        source.source
                      }
                    </span>

                    <strong className="ml-2 text-zinc-950">
                      {
                        source.count
                      }
                    </strong>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="text-sm text-zinc-400">
              내원경로 데이터 없음
            </div>
          )}
        </section>

        {/* 당취 */}

        <section>
          <h3 className="mb-3 text-sm font-black text-red-600">
            당일취소
          </h3>

          {day.cancellations
            .length > 0 ? (
            <div className="space-y-2">
              {day.cancellations.map(
                (
                  item,
                  index
                ) => (
                  <div
                    key={`${item}-${index}`}
                    className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {item}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-400">
              당일취소 없음
            </div>
          )}
        </section>

        {/* 경고 */}

        {day.warnings.length >
          0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 font-bold text-amber-800">
              자동 분석 확인 필요
            </div>

            <div className="space-y-2">
              {day.warnings.map(
                (
                  warning,
                  index
                ) => (
                  <div
                    key={index}
                    className="text-sm text-amber-700"
                  >
                    <strong>
                      {
                        warning.line
                      }
                    </strong>

                    {" — "}

                    {
                      warning.reason
                    }
                  </div>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

export default function PastePage() {
  const currentYear =
    new Date().getFullYear();

  const [year, setYear] =
    useState(currentYear);

  const [text, setText] =
    useState("");

  const [days, setDays] =
    useState<ParsedDay[]>(
      []
    );

  const [
    previewSummary,
    setPreviewSummary,
  ] = useState<
    PreviewResponse["summary"] |
      null
  >(null);

  const [
    analyzing,
    setAnalyzing,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const totalApplications =
    useMemo(
      () =>
        days.reduce(
          (sum, day) =>
            sum +
            getTotalApplications(
              day
            ),
          0
        ),
      [days]
    );

  const totalReservations =
    useMemo(
      () =>
        days.reduce(
          (sum, day) =>
            sum +
            getTotalReservations(
              day
            ),
          0
        ),
      [days]
    );

  const totalIncalls =
    useMemo(
      () =>
        days.reduce(
          (sum, day) =>
            sum +
            day.incall.total,
          0
        ),
      [days]
    );

  const totalCancellations =
    useMemo(
      () =>
        days.reduce(
          (sum, day) =>
            sum +
            day.cancellations
              .length,
          0
        ),
      [days]
    );

  async function analyze() {
    setError("");
    setMessage("");
    setDays([]);
    setPreviewSummary(null);

    if (!text.trim()) {
      setError(
        "텔레그램 DB보고 내용을 붙여넣어주세요."
      );

      return;
    }

    setAnalyzing(true);

    try {
      const response =
        await fetch(
          "/api/admin/paste/preview",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              text,
              year,
            }),
          }
        );

      const result =
        (await response.json()) as PreviewResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "DB보고 분석에 실패했습니다."
        );
      }

      setDays(
        result.days ?? []
      );

      setPreviewSummary(
        result.summary ?? null
      );

      setMessage(
        `${result.days?.length ?? 0}일치 DB보고를 분석했습니다. 저장 전에 숫자를 확인해주세요.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "DB보고 분석에 실패했습니다."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveAll() {
    if (
      days.length === 0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `${days.length}일치 데이터를 저장할까요?\n\n같은 날짜의 기존 일별 데이터는 현재 내용으로 교체되고 월간 합계도 자동 갱신됩니다.`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/paste/commit",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              days,
            }),
          }
        );

      const result =
        (await response.json()) as CommitResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "DB보고 저장에 실패했습니다."
        );
      }

      setMessage(
        result.message ??
          "DB보고 저장이 완료되었습니다."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "DB보고 저장에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1450px] px-6 py-10">
        {/* 상단 */}

        <div className="mb-8">
          <a
            href="/admin"
            className="text-sm font-bold text-blue-600 hover:underline"
          >
            ← 관리자
          </a>

          <div className="mt-7 text-sm font-black tracking-wide text-blue-600">
            MIHO PERFORMANCE · ADMIN
          </div>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-zinc-950">
            DB보고 붙여넣기
          </h1>

          <p className="mt-2 text-zinc-500">
            텔레그램으로 받은 DB보고내역을 수정하지 않고
            통째로 붙여넣으세요.
          </p>
        </div>

        {/* 입력 */}

        <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-zinc-950">
                텔레그램 DB보고
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                여러 날짜를 한 번에 붙여넣어도 자동으로
                분리합니다.
              </p>
            </div>

            <label className="block">
              <div className="mb-1 text-xs font-bold text-zinc-500">
                보고 연도
              </div>

              <select
                value={year}
                onChange={(event) =>
                  setYear(
                    Number(
                      event.target.value
                    )
                  )
                }
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
              >
                {[
                  currentYear - 2,
                  currentYear - 1,
                  currentYear,
                  currentYear + 1,
                ].map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}년
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <textarea
            value={text}
            onChange={(event) => {
              setText(
                event.target.value
              );

              if (
                days.length > 0
              ) {
                setDays([]);
                setPreviewSummary(
                  null
                );
              }
            }}
            placeholder={`예)

8/1 DB보고내역

홈페이지 1/4
바비톡 1/1
강남언니 0/0
네이버 0/0
기타(검색.소개.유투브.플친) 0/0
CPA 0/5

전날콜 총7/부1/국1/확5
7콜 총2/확2

<내원경로>
인터넷검색-3
건너소개-3

<총인콜26>
신규9
단순9
변경7
취소1

<당취>
김윤정 (1931)`}
            className="min-h-[430px] w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 p-5 font-mono text-sm leading-7 text-zinc-800 outline-none transition focus:border-blue-500 focus:bg-white"
          />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-zinc-400">
              {text.length > 0
                ? `${text.length.toLocaleString()}자 입력됨`
                : "DB보고 원문을 그대로 붙여넣으세요."}
            </div>

            <button
              type="button"
              onClick={analyze}
              disabled={
                analyzing ||
                !text.trim()
              }
              className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {analyzing
                ? "분석 중..."
                : "DB보고 분석하기"}
            </button>
          </div>
        </section>

        {/* 오류 */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-bold text-red-700">
            {error}
          </div>
        )}

        {/* 성공 */}

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-bold text-emerald-700">
            {message}
          </div>
        )}

        {/* 분석 결과 */}

        {days.length > 0 && (
          <>
            <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div>
                  <div className="text-sm font-bold text-zinc-500">
                    분석 결과
                  </div>

                  <div className="mt-1 text-2xl font-black text-zinc-950">
                    {days.length}일치 DB보고
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* 예약 먼저 */}

                  <div className="rounded-xl bg-violet-50 px-5 py-3">
                    <div className="text-xs font-bold text-violet-500">
                      예약
                    </div>

                    <div className="mt-1 text-xl font-black text-violet-700">
                      {
                        totalReservations
                      }
                    </div>
                  </div>

                  {/* 신청 다음 */}

                  <div className="rounded-xl bg-blue-50 px-5 py-3">
                    <div className="text-xs font-bold text-blue-500">
                      신청
                    </div>

                    <div className="mt-1 text-xl font-black text-blue-700">
                      {
                        totalApplications
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-zinc-100 px-5 py-3">
                    <div className="text-xs font-bold text-zinc-500">
                      총인콜
                    </div>

                    <div className="mt-1 text-xl font-black text-zinc-900">
                      {
                        totalIncalls
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-red-50 px-5 py-3">
                    <div className="text-xs font-bold text-red-500">
                      당취
                    </div>

                    <div className="mt-1 text-xl font-black text-red-600">
                      {
                        totalCancellations
                      }
                      건
                    </div>
                  </div>
                </div>
              </div>

              {previewSummary &&
                previewSummary.warnings >
                  0 && (
                  <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                    자동 인식 확인이 필요한 항목이{" "}
                    {
                      previewSummary.warnings
                    }
                    건 있습니다.
                  </div>
                )}
            </section>

            <div className="mt-6 space-y-5">
              {days.map(
                (day) => (
                  <DayPreview
                    key={day.date}
                    day={day}
                  />
                )
              )}
            </div>

            {/* 저장 */}

            <div className="sticky bottom-5 z-20 mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-xl backdrop-blur">
                <div>
                  <div className="font-black text-zinc-950">
                    숫자를 확인했나요?
                  </div>

                  <div className="mt-1 text-sm text-zinc-500">
                    저장하면 일별 데이터와 해당 월 합계가 함께
                    갱신됩니다.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveAll}
                  disabled={saving}
                  className="rounded-xl bg-zinc-950 px-7 py-3 font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {saving
                    ? "저장 중..."
                    : `${days.length}일치 전체 저장`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}