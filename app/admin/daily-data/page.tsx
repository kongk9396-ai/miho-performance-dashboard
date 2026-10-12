"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type DaySummary = {
  date: string;

  hasReport: boolean;
  applications: number;
  reservations: number;
  platformRows: number;
  callRows: number;
  visitSourceRows: number;
  incallTotal: number;
  cancellationRows: number;

  hasConversion: boolean;
  consultations: number;
  surgeries: number;
  categoryRows: number;
  doctorRows: number;
};

type ListResponse = {
  ok: boolean;
  message?: string;
  locked?: boolean;
  days?: DaySummary[];
};

type DeleteResponse = {
  ok: boolean;
  message?: string;
};

const WEEKDAYS = [
  "일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
];

function currentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function shiftMonth(
  month: string,
  diff: number
) {
  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    monthNumber - 1 + diff,
    1
  );

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatDate(date: string) {
  const [year, month, day] = date
    .split("-")
    .map(Number);

  const weekday =
    WEEKDAYS[
      new Date(
        year,
        month - 1,
        day
      ).getDay()
    ];

  return `${month}/${day} (${weekday})`;
}

async function fetchMonth(
  target: string
): Promise<ListResponse> {
  try {
    const response = await fetch(
      `/api/admin/daily-data?month=${target}`,
      { cache: "no-store" }
    );

    const result =
      (await response.json()) as ListResponse;

    if (!response.ok && result.ok) {
      return {
        ok: false,
        message:
          "데이터를 불러오지 못했습니다.",
      };
    }

    return result;
  } catch {
    return {
      ok: false,
      message:
        "데이터를 불러오지 못했습니다.",
    };
  }
}

export default function DailyDataPage() {
  const [month, setMonth] =
    useState(currentMonth);

  const [days, setDays] = useState<
    DaySummary[]
  >([]);

  const [locked, setLocked] =
    useState(false);

  const [selected, setSelected] =
    useState<Set<string>>(
      () => new Set()
    );

  const [deleteReport, setDeleteReport] =
    useState(true);

  const [
    deleteConversion,
    setDeleteConversion,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [deleting, setDeleting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const applyResult = useCallback(
    (result: ListResponse) => {
      if (result.ok) {
        setDays(result.days ?? []);
        setLocked(
          Boolean(result.locked)
        );
        setError("");
      } else {
        setDays([]);
        setError(
          result.message ??
            "데이터를 불러오지 못했습니다."
        );
      }

      setLoading(false);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    fetchMonth(month).then(
      (result) => {
        if (!cancelled) {
          applyResult(result);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [month, applyResult]);

  function changeMonth(
    next: string
  ) {
    if (!next || next === month) {
      return;
    }

    setLoading(true);
    setSelected(new Set());
    setMessage("");
    setMonth(next);
  }

  async function reload() {
    setLoading(true);
    setSelected(new Set());
    applyResult(
      await fetchMonth(month)
    );
  }

  const allSelected =
    days.length > 0 &&
    selected.size === days.length;

  const selectedDays = useMemo(
    () =>
      days.filter((day) =>
        selected.has(day.date)
      ),
    [days, selected]
  );

  function toggle(date: string) {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }

      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allSelected
        ? new Set()
        : new Set(
            days.map((day) => day.date)
          )
    );
  }

  async function remove() {
    if (selectedDays.length === 0) {
      return;
    }

    const groups: string[] = [];
    const labels: string[] = [];

    if (deleteReport) {
      groups.push("report");
      labels.push(
        "DB보고 (플랫폼 신청/예약, 전날콜·7콜, 내원경로, 총인콜, 당취, 보고 원문)"
      );
    }

    if (deleteConversion) {
      groups.push("conversion");
      labels.push(
        "상담·수술 전환 (일별 전환, 부위별, 원장별)"
      );
    }

    if (groups.length === 0) {
      setError(
        "삭제할 데이터 종류를 하나 이상 선택해주세요."
      );
      return;
    }

    const dateText = selectedDays
      .map((day) =>
        formatDate(day.date)
      )
      .join(", ");

    const confirmed = window.confirm(
      `아래 날짜의 데이터를 삭제할까요?\n\n날짜: ${dateText}\n\n삭제 항목:\n- ${labels.join(
        "\n- "
      )}\n\n삭제 후 월간 합계는 남은 데이터로 다시 계산됩니다.\n되돌릴 수 없습니다.`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/daily-data",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            dates: selectedDays.map(
              (day) => day.date
            ),
            groups,
          }),
        }
      );

      const result =
        (await response.json()) as DeleteResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "삭제에 실패했습니다."
        );
      }

      setMessage(
        result.message ??
          "삭제했습니다."
      );

      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "삭제에 실패했습니다."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
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
            날짜별 데이터 삭제
          </h1>

          <p className="mt-2 text-zinc-500">
            잘못 입력된 날짜의 데이터를 지웁니다. 숫자만 틀렸다면
            삭제 대신 맞는 내용을 같은 날짜로 다시 붙여넣으면 덮어써집니다.
          </p>
        </div>

        {/* 월 선택 */}

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                changeMonth(
                  shiftMonth(month, -1)
                )
              }
              className="rounded-xl border border-zinc-200 px-3 py-2 font-bold text-zinc-600 hover:bg-zinc-50"
            >
              ←
            </button>

            <input
              type="month"
              value={month}
              onChange={(event) =>
                changeMonth(
                  event.target.value
                )
              }
              className="rounded-xl border border-zinc-200 px-4 py-2 font-bold outline-none focus:border-blue-500"
            />

            <button
              type="button"
              onClick={() =>
                changeMonth(
                  shiftMonth(month, 1)
                )
              }
              className="rounded-xl border border-zinc-200 px-3 py-2 font-bold text-zinc-600 hover:bg-zinc-50"
            >
              →
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-zinc-700">
            <span className="text-zinc-400">
              삭제 항목
            </span>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deleteReport}
                onChange={(event) =>
                  setDeleteReport(
                    event.target.checked
                  )
                }
                className="h-4 w-4"
              />
              DB보고
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deleteConversion}
                onChange={(event) =>
                  setDeleteConversion(
                    event.target.checked
                  )
                }
                className="h-4 w-4"
              />
              상담·수술 전환
            </label>
          </div>
        </section>

        {locked && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 font-bold text-amber-700">
            이 달은 마감된 월이라 삭제할 수 없습니다. 마감을 먼저
            해제해주세요.
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-bold text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-bold text-emerald-700">
            {message}
          </div>
        )}

        {/* 목록 */}

        <section className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-zinc-50 text-xs font-bold text-zinc-500">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={
                        days.length === 0
                      }
                      className="h-4 w-4"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    날짜
                  </th>
                  <th className="px-4 py-3 text-right">
                    예약
                  </th>
                  <th className="px-4 py-3 text-right">
                    신청
                  </th>
                  <th className="px-4 py-3 text-right">
                    총인콜
                  </th>
                  <th className="px-4 py-3 text-right">
                    당취
                  </th>
                  <th className="px-4 py-3 text-right">
                    상담
                  </th>
                  <th className="px-4 py-3 text-right">
                    수술결정
                  </th>
                  <th className="px-4 py-3 text-left">
                    저장된 데이터
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-zinc-400"
                    >
                      불러오는 중...
                    </td>
                  </tr>
                ) : days.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-zinc-400"
                    >
                      이 달에 저장된 일별 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  days.map((day) => {
                    const checked =
                      selected.has(
                        day.date
                      );

                    return (
                      <tr
                        key={day.date}
                        onClick={() =>
                          toggle(day.date)
                        }
                        className={`cursor-pointer border-t border-zinc-100 transition ${
                          checked
                            ? "bg-red-50"
                            : "hover:bg-zinc-50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggle(
                                day.date
                              )
                            }
                            onClick={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="px-4 py-3 font-black text-zinc-900">
                          {formatDate(
                            day.date
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-violet-600">
                          {day.hasReport
                            ? day.reservations
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                          {day.hasReport
                            ? day.applications
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700">
                          {day.hasReport
                            ? day.incallTotal
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          {day.hasReport
                            ? day.cancellationRows
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700">
                          {day.hasConversion
                            ? day.consultations
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700">
                          {day.hasConversion
                            ? day.surgeries
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {day.hasReport && (
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                                DB보고
                              </span>
                            )}
                            {day.hasConversion && (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                                전환
                                {day.doctorRows >
                                0
                                  ? ` · 원장 ${day.doctorRows}`
                                  : ""}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 삭제 바 */}

        {selectedDays.length > 0 && (
          <div className="sticky bottom-5 z-20 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200 bg-white/95 p-5 shadow-xl backdrop-blur">
              <div>
                <div className="font-black text-zinc-950">
                  {selectedDays.length}일 선택됨
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  삭제 후 해당 월 합계가 자동으로 다시 계산됩니다.
                </div>
              </div>

              <button
                type="button"
                onClick={remove}
                disabled={
                  deleting ||
                  locked ||
                  (!deleteReport &&
                    !deleteConversion)
                }
                className="rounded-xl bg-red-600 px-7 py-3 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deleting
                  ? "삭제 중..."
                  : "선택한 날짜 삭제"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
