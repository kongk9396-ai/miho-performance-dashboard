"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type PlatformRow = {
  id: number;
  name: string;

  sortOrder: number;

  includeInTotal:
    boolean;

  includeInChannelChart:
    boolean;

  applications: number;
  reservations: number;
};

function currentMonth() {
  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(
    2,
    "0"
  )}`;
}

function safeInput(
  value: string
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(number)
  );
}

function rate(
  reservations: number,
  applications: number
) {
  if (
    applications <= 0
  ) {
    return 0;
  }

  return (
    reservations /
    applications *
    100
  );
}

export default function MonthlyPlatformManager() {
  const [
    month,
    setMonth,
  ] =
    useState(
      currentMonth()
    );

  const [
    rows,
    setRows,
  ] =
    useState<
      PlatformRow[]
    >([]);

  const [
    isLocked,
    setIsLocked,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");


  /* ========================================================
     load
  ======================================================== */

  const load =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setMessage(
          ""
        );

        try {
          const response =
            await fetch(
              `/api/admin/platform-monthly?month=${month}`,
              {
                cache:
                  "no-store",
              }
            );

          const json =
            await response.json();

          if (
            !response.ok ||
            !json.ok
          ) {
            throw new Error(
              json.message ??
                "불러오기 실패"
            );
          }

          setRows(
            json.platforms ??
              []
          );

          setIsLocked(
            Boolean(
              json.isLocked
            )
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "불러오기 실패"
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        month,
      ]
    );

  useEffect(() => {
    void load();
  }, [
    load,
  ]);


  /* ========================================================
     합계
  ======================================================== */

  const totals =
    useMemo(
      () => {
        const included =
          rows.filter(
            (row) =>
              row.includeInTotal
          );

        const applications =
          included.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.applications,
            0
          );

        const reservations =
          included.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.reservations,
            0
          );

        return {
          applications,

          reservations,

          reservationRate:
            rate(
              reservations,
              applications
            ),
        };
      },
      [
        rows,
      ]
    );


  /* ========================================================
     검증
  ======================================================== */

  const warnings =
    useMemo(
      () => {
        const result:
          string[] = [];

        for (
          const row of rows
        ) {
          if (
            row.reservations >
            row.applications &&
            row.applications >
              0
          ) {
            result.push(
              `${row.name}: 예약이 신청보다 많습니다.`
            );
          }

          if (
            row.applications ===
              0 &&
            row.reservations >
              0
          ) {
            result.push(
              `${row.name}: 신청은 0인데 예약이 ${row.reservations}건입니다.`
            );
          }
        }

        return result;
      },
      [
        rows,
      ]
    );


  /* ========================================================
     save
  ======================================================== */

  async function save() {
    setSaving(
      true
    );

    setMessage(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/admin/platform-monthly",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                month,

                action:
                  "save",

                platforms:
                  rows,
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.ok
      ) {
        throw new Error(
          json.message ??
            "저장 실패"
        );
      }

      setMessage(
        "플랫폼 월간 실적을 저장했습니다."
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "저장 실패"
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  /* ========================================================
     lock / unlock
  ======================================================== */

  async function toggleLock() {
    const action =
      isLocked
        ? "unlock"
        : "lock";

    const text =
      isLocked
        ? "마감을 해제할까요?"
        : "이 월을 마감할까요?\n마감 후에는 수정할 수 없습니다.";

    if (
      !window.confirm(
        text
      )
    ) {
      return;
    }

    setSaving(
      true
    );

    try {
      const response =
        await fetch(
          "/api/admin/platform-monthly",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                month,
                action,
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.ok
      ) {
        throw new Error(
          json.message ??
            "처리 실패"
        );
      }

      setMessage(
        json.message
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "처리 실패"
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  return (
    <section className="mx-auto mt-8 max-w-[1500px] px-6 pb-10 lg:px-8">

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        {/* ===============================
            HEADER
        =============================== */}

        <div className="flex flex-col gap-5 border-b border-zinc-100 p-6 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <h2 className="text-xl font-black text-zinc-950">
              플랫폼별 월간 실적 직접 수정
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              신청·예약 값을 직접 입력하면 예약률과 합계가 자동 계산됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            <input
              type="month"
              value={
                month
              }
              onChange={(
                event
              ) =>
                setMonth(
                  event.target.value
                )
              }
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold"
            />

            <button
              type="button"
              onClick={
                toggleLock
              }
              disabled={
                loading ||
                saving
              }
              className={
                isLocked
                  ? "rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-700"
                  : "rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-black text-zinc-700"
              }
            >
              {isLocked
                ? "🔒 마감 해제"
                : "월 마감"}
            </button>

            <button
              type="button"
              onClick={
                save
              }
              disabled={
                loading ||
                saving ||
                isLocked
              }
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "저장 중..."
                : "플랫폼 실적 저장"}
            </button>

          </div>
        </div>


        {/* ===============================
            STATUS
        =============================== */}

        {isLocked && (
          <div className="border-b border-amber-100 bg-amber-50 px-6 py-3 text-sm font-bold text-amber-700">
            🔒 이 월은 마감되었습니다. 수정하려면 마감을 해제하세요.
          </div>
        )}

        {message && (
          <div className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-sm font-bold text-blue-700">
            {message}
          </div>
        )}


        {/* ===============================
            TOTAL
        =============================== */}

        <div className="grid grid-cols-1 gap-3 bg-zinc-50 p-5 sm:grid-cols-3">

          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-bold text-zinc-500">
              총 신청
            </p>

            <p className="mt-1 text-2xl font-black">
              {totals.applications.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-bold text-zinc-500">
              총 예약
            </p>

            <p className="mt-1 text-2xl font-black">
              {totals.reservations.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-bold text-blue-600">
              전체 예약률
            </p>

            <p className="mt-1 text-2xl font-black text-blue-600">
              {totals.reservationRate.toFixed(
                2
              )}
              %
            </p>
          </div>

        </div>


        {/* ===============================
            VALIDATION
        =============================== */}

        {warnings.length >
          0 && (
          <div className="border-y border-red-100 bg-red-50 px-6 py-4">

            <p className="text-sm font-black text-red-700">
              ⚠ 입력값 확인
            </p>

            <div className="mt-2 space-y-1">

              {warnings.map(
                (
                  warning,
                  index
                ) => (
                  <p
                    key={
                      index
                    }
                    className="text-sm font-semibold text-red-600"
                  >
                    • {warning}
                  </p>
                )
              )}

            </div>
          </div>
        )}


        {/* ===============================
            TABLE
        =============================== */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[800px] border-collapse">

            <thead>
              <tr className="border-b border-zinc-200 bg-[#b8d3f5] text-sm font-black">

                <th className="px-5 py-4 text-left">
                  플랫폼
                </th>

                <th className="px-5 py-4 text-right">
                  신청
                </th>

                <th className="px-5 py-4 text-right">
                  예약
                </th>

                <th className="px-5 py-4 text-right">
                  예약률
                </th>

                <th className="px-5 py-4 text-center">
                  합계 포함
                </th>

                <th className="px-5 py-4 text-center">
                  차트 표시
                </th>

              </tr>
            </thead>


            <tbody>

              {rows.map(
                (
                  row,
                  index
                ) => {
                  const rowRate =
                    rate(
                      row.reservations,
                      row.applications
                    );

                  return (
                    <tr
                      key={
                        row.id
                      }
                      className="border-b border-zinc-100"
                    >

                      <td className="px-5 py-4 font-black text-zinc-900">
                        {row.name}
                      </td>


                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          disabled={
                            isLocked
                          }
                          value={
                            row.applications ===
                            0
                              ? ""
                              : row.applications
                          }
                          placeholder="0"
                          onChange={(
                            event
                          ) => {
                            const value =
                              safeInput(
                                event.target.value
                              );

                            setRows(
                              (
                                previous
                              ) =>
                                previous.map(
                                  (
                                    item,
                                    rowIndex
                                  ) =>
                                    rowIndex ===
                                    index
                                      ? {
                                          ...item,

                                          applications:
                                            value,
                                        }
                                      : item
                                )
                            );
                          }}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-right font-bold outline-none focus:border-blue-500 disabled:bg-zinc-100"
                        />
                      </td>


                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          disabled={
                            isLocked
                          }
                          value={
                            row.reservations ===
                            0
                              ? ""
                              : row.reservations
                          }
                          placeholder="0"
                          onChange={(
                            event
                          ) => {
                            const value =
                              safeInput(
                                event.target.value
                              );

                            setRows(
                              (
                                previous
                              ) =>
                                previous.map(
                                  (
                                    item,
                                    rowIndex
                                  ) =>
                                    rowIndex ===
                                    index
                                      ? {
                                          ...item,

                                          reservations:
                                            value,
                                        }
                                      : item
                                )
                            );
                          }}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-right font-bold outline-none focus:border-blue-500 disabled:bg-zinc-100"
                        />
                      </td>


                      <td className="px-5 py-4 text-right font-black text-blue-600">
                        {rowRate.toFixed(
                          1
                        )}
                        %
                      </td>


                      <td className="px-5 py-4 text-center">
                        {row.includeInTotal
                          ? "✓"
                          : "—"}
                      </td>


                      <td className="px-5 py-4 text-center">
                        {row.includeInChannelChart
                          ? "✓"
                          : "—"}
                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>
          </table>

        </div>
      </div>
    </section>
  );
}
