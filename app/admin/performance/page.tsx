"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ManagerRow = {
  managerId: number;
  managerName: string;
  consultations: number;
  surgeries: number;
  conversionRate: number;
  revenue: number;
};

type PerformanceSummary = {
  consultations: number;
  surgeries: number;
  conversionRate: number;
  revenue: number;
};

type PerformanceResponse = {
  ok: boolean;
  message?: string;

  data?: {
    month: string;
    summary: PerformanceSummary;
    managers: ManagerRow[];
  };
};

type SaveResponse = {
  ok: boolean;
  message?: string;

  data?: {
    month: string;
    summary: PerformanceSummary;
    savedManagers: number;
  };
};

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-01`;
}

function monthInputValue(
  month: string
) {
  return month.slice(0, 7);
}

function toMonthDate(
  value: string
) {
  return `${value}-01`;
}

function safeNumber(
  value: string
) {
  const number = Number(
    value.replace(/,/g, "")
  );

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(number)
  );
}

function formatNumber(
  value: number
) {
  return Math.round(
    value || 0
  ).toLocaleString("ko-KR");
}

function formatWon(
  value: number
) {
  return `${formatNumber(value)}원`;
}

function formatRate(
  value: number
) {
  if (!Number.isFinite(value)) {
    return "0.0%";
  }

  return `${value.toFixed(1)}%`;
}

function getConversionRate(
  consultations: number,
  surgeries: number
) {
  if (consultations <= 0) {
    return 0;
  }

  return (
    (surgeries / consultations) *
    100
  );
}

export default function PerformancePage() {
  const [month, setMonth] =
    useState(
      getCurrentMonth()
    );

  const [rows, setRows] =
    useState<ManagerRow[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  /*
  =========================================
  현재 입력값 기준 합계
  =========================================
  */

  const summary =
    useMemo<PerformanceSummary>(
      () => {
        const totals =
          rows.reduce(
            (acc, row) => {
              acc.consultations +=
                Number(
                  row.consultations
                ) || 0;

              acc.surgeries +=
                Number(
                  row.surgeries
                ) || 0;

              acc.revenue +=
                Number(
                  row.revenue
                ) || 0;

              return acc;
            },
            {
              consultations: 0,
              surgeries: 0,
              revenue: 0,
            }
          );

        return {
          ...totals,

          conversionRate:
            getConversionRate(
              totals.consultations,
              totals.surgeries
            ),
        };
      },
      [rows]
    );

  /*
  =========================================
  데이터 불러오기
  =========================================
  */

  const loadData =
    useCallback(
      async (
        selectedMonth: string
      ) => {
        setLoading(true);
        setError("");
        setMessage("");

        try {
          const response =
            await fetch(
              `/api/admin/performance?month=${encodeURIComponent(
                selectedMonth
              )}`,
              {
                method: "GET",

                cache:
                  "no-store",
              }
            );

          const result =
            (await response.json()) as PerformanceResponse;

          if (
            !response.ok ||
            !result.ok
          ) {
            throw new Error(
              result.message ??
                "실장별 실적을 불러오지 못했습니다."
            );
          }

          setRows(
            (
              result.data
                ?.managers ??
              []
            ).map(
              (row) => ({
                ...row,

                consultations:
                  Number(
                    row.consultations
                  ) || 0,

                surgeries:
                  Number(
                    row.surgeries
                  ) || 0,

                revenue:
                  Number(
                    row.revenue
                  ) || 0,
              })
            )
          );
        } catch (err) {
          setRows([]);

          setError(
            err instanceof Error
              ? err.message
              : "실장별 실적을 불러오지 못했습니다."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadData(month);
  }, [
    month,
    loadData,
  ]);

  /*
  =========================================
  입력값 변경
  =========================================
  */

  function updateRow(
    managerId: number,
    field:
      | "consultations"
      | "surgeries"
      | "revenue",
    value: string
  ) {
    const number =
      safeNumber(value);

    setRows(
      (current) =>
        current.map(
          (row) => {
            if (
              row.managerId !==
              managerId
            ) {
              return row;
            }

            const updated = {
              ...row,
              [field]:
                number,
            };

            return {
              ...updated,

              conversionRate:
                getConversionRate(
                  updated.consultations,
                  updated.surgeries
                ),
            };
          }
        )
    );

    setMessage("");
  }

  /*
  =========================================
  전체 저장
  =========================================
  */

  async function saveAll() {
    if (
      rows.length === 0
    ) {
      setError(
        "저장할 실장 데이터가 없습니다."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `${month.slice(
          0,
          7
        )} 실장별 실적을 저장할까요?\n\n현재 입력된 상담·수술·매출 값으로 해당 월 데이터가 갱신됩니다.`
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
          "/api/admin/performance",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                month,

                managers:
                  rows.map(
                    (row) => ({
                      managerId:
                        row.managerId,

                      consultations:
                        row.consultations,

                      surgeries:
                        row.surgeries,

                      revenue:
                        row.revenue,
                    })
                  ),
              }),
          }
        );

      const result =
        (await response.json()) as SaveResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "실장별 실적 저장에 실패했습니다."
        );
      }

      setMessage(
        result.message ??
          "실장별 실적과 매출을 저장했습니다."
      );

      await loadData(
        month
      );

      setMessage(
        result.message ??
          "실장별 실적과 매출을 저장했습니다."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "실장별 실적 저장에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1450px] px-6 py-10">
        {/* HEADER */}

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

          <div className="mt-1 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-950">
                실장별 실적 / 매출
              </h1>

              <p className="mt-2 text-zinc-500">
                월별 상담·수술·매출을 입력하면
                전환율과 전체 실적을 자동 계산합니다.
              </p>
            </div>

            {/* 월 선택 */}

            <label className="block">
              <div className="mb-1 text-xs font-bold text-zinc-500">
                기준월
              </div>

              <input
                type="month"
                value={
                  monthInputValue(
                    month
                  )
                }
                onChange={(
                  event
                ) => {
                  if (
                    !event.target
                      .value
                  ) {
                    return;
                  }

                  setMonth(
                    toMonthDate(
                      event.target
                        .value
                    )
                  );
                }}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 font-bold text-zinc-900 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-bold text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-bold text-emerald-700">
            {message}
          </div>
        )}

        {/* KPI */}

        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-zinc-500">
              전체 상담
            </div>

            <div className="mt-2 text-3xl font-black text-zinc-950">
              {formatNumber(
                summary.consultations
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-zinc-500">
              전체 수술
            </div>

            <div className="mt-2 text-3xl font-black text-blue-600">
              {formatNumber(
                summary.surgeries
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-zinc-500">
              상담 → 수술 전환율
            </div>

            <div className="mt-2 text-3xl font-black text-violet-600">
              {formatRate(
                summary.conversionRate
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-zinc-500">
              전체 매출
            </div>

            <div className="mt-2 text-3xl font-black text-emerald-600">
              {formatWon(
                summary.revenue
              )}
            </div>
          </div>
        </section>

        {/* TABLE */}

        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-6 py-5">
            <div>
              <h2 className="text-xl font-black text-zinc-950">
                실장별 입력
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                숫자를 입력하면 합계와 전환율이 즉시
                계산됩니다.
              </p>
            </div>

            {!loading && (
              <div className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-600">
                실장 {rows.length}명
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-16 text-center font-bold text-zinc-400">
              실적을 불러오는 중...
            </div>
          ) : rows.length ===
            0 ? (
            <div className="p-16 text-center">
              <div className="text-lg font-black text-zinc-700">
                등록된 실장이 없습니다.
              </div>

              <div className="mt-2 text-sm text-zinc-400">
                다음 단계의 실장 관리에서 실장을 먼저
                등록하면 여기에 자동으로 표시됩니다.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-left text-xs font-black uppercase tracking-wide text-zinc-500">
                    <th className="px-6 py-4">
                      실장
                    </th>

                    <th className="px-4 py-4 text-right">
                      상담
                    </th>

                    <th className="px-4 py-4 text-right">
                      수술
                    </th>

                    <th className="px-4 py-4 text-right">
                      전환율
                    </th>

                    <th className="px-6 py-4 text-right">
                      매출
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map(
                    (row) => {
                      const rate =
                        getConversionRate(
                          row.consultations,
                          row.surgeries
                        );

                      return (
                        <tr
                          key={
                            row.managerId
                          }
                          className="border-t border-zinc-100"
                        >
                          <td className="px-6 py-5">
                            <div className="font-black text-zinc-900">
                              {
                                row.managerName
                              }
                            </div>
                          </td>

                          <td className="px-4 py-5">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={
                                row.consultations
                              }
                              onChange={(
                                event
                              ) =>
                                updateRow(
                                  row.managerId,
                                  "consultations",
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="ml-auto block w-28 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-right font-bold outline-none transition focus:border-blue-500 focus:bg-white"
                            />
                          </td>

                          <td className="px-4 py-5">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={
                                row.surgeries
                              }
                              onChange={(
                                event
                              ) =>
                                updateRow(
                                  row.managerId,
                                  "surgeries",
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="ml-auto block w-28 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-right font-bold outline-none transition focus:border-blue-500 focus:bg-white"
                            />
                          </td>

                          <td className="px-4 py-5 text-right">
                            <span className="inline-flex rounded-xl bg-violet-50 px-3 py-2 font-black text-violet-700">
                              {formatRate(
                                rate
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  row.revenue
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateRow(
                                    row.managerId,
                                    "revenue",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="w-44 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-right font-bold outline-none transition focus:border-blue-500 focus:bg-white"
                              />

                              <span className="text-sm font-bold text-zinc-400">
                                원
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>

                <tfoot>
                  <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                    <td className="px-6 py-5 font-black text-zinc-950">
                      합계
                    </td>

                    <td className="px-4 py-5 text-right text-lg font-black text-zinc-950">
                      {formatNumber(
                        summary.consultations
                      )}
                    </td>

                    <td className="px-4 py-5 text-right text-lg font-black text-blue-600">
                      {formatNumber(
                        summary.surgeries
                      )}
                    </td>

                    <td className="px-4 py-5 text-right">
                      <span className="inline-flex rounded-xl bg-violet-100 px-3 py-2 font-black text-violet-700">
                        {formatRate(
                          summary.conversionRate
                        )}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-right text-lg font-black text-emerald-600">
                      {formatWon(
                        summary.revenue
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* SAVE BAR */}

        {rows.length > 0 &&
          !loading && (
            <div className="sticky bottom-5 z-20 mt-7">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-xl backdrop-blur">
                <div>
                  <div className="font-black text-zinc-950">
                    {month.slice(
                      0,
                      7
                    )}{" "}
                    실장별 실적
                  </div>

                  <div className="mt-1 text-sm text-zinc-500">
                    상담·수술·매출 입력값을
                    저장합니다.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    saveAll
                  }
                  disabled={
                    saving
                  }
                  className="rounded-xl bg-blue-600 px-7 py-3 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {saving
                    ? "저장 중..."
                    : "실적 전체 저장"}
                </button>
              </div>
            </div>
          )}
      </div>
    </main>
  );
}