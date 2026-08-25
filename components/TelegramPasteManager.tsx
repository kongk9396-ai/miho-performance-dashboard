"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  Save,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

type PlatformRow = {
  platform: string;
  applications: number;
  reservations: number;
  raw: string;
};

type WarningRow = {
  line: string;
  reason: string;
};

type ParsedDay = {
  date: string;
  platforms: PlatformRow[];
  warnings: WarningRow[];
};

function formatDate(
  date: string
) {
  const [
    year,
    month,
    day,
  ] = date.split("-");

  return `${year}.${month}.${day}`;
}

export default function TelegramPasteManager() {
  const [text, setText] =
    useState("");

  const [year, setYear] =
    useState(
      new Date().getFullYear()
    );

  const [days, setDays] =
    useState<ParsedDay[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(
      null
    );

  const totalRows =
    useMemo(
      () =>
        days.reduce(
          (sum, day) =>
            sum +
            day.platforms
              .length,
          0
        ),
      [days]
    );

  async function analyze() {
    if (!text.trim()) {
      setMessage(
        "텔레그램 내용을 붙여넣어주세요."
      );

      return;
    }

    setLoading(true);
    setMessage(null);

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
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message
        );
      }

      setDays(result.days);

      setMessage(
        `${result.summary.days}일 · ${result.summary.platformRows}건 인식 · 경고 ${result.summary.warnings}건`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "내용 분석 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  function updatePlatform(
    dayIndex: number,
    rowIndex: number,
    field:
      | "applications"
      | "reservations",
    value: number
  ) {
    setDays((prev) =>
      prev.map(
        (
          day,
          currentDayIndex
        ) =>
          currentDayIndex ===
          dayIndex
            ? {
                ...day,

                platforms:
                  day.platforms.map(
                    (
                      row,
                      currentRowIndex
                    ) =>
                      currentRowIndex ===
                      rowIndex
                        ? {
                            ...row,
                            [field]:
                              Math.max(
                                0,
                                value ||
                                  0
                              ),
                          }
                        : row
                  ),
              }
            : day
      )
    );
  }

  async function save() {
    if (!days.length) {
      return;
    }

    const warningCount =
      days.reduce(
        (sum, day) =>
          sum +
          day.warnings.length,
        0
      );

    if (
      warningCount > 0
    ) {
      const confirmed =
        window.confirm(
          `확인 필요 항목이 ${warningCount}건 있습니다.\n경고 항목은 저장하지 않고 인식된 데이터만 저장할까요?`
        );

      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    setMessage(null);

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
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message
        );
      }

      setMessage(
        `✅ ${result.message}`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "저장 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <ClipboardPaste
              size={22}
            />
          </div>

          <div>
            <h2 className="text-lg font-bold">
              텔레그램 DB 보고 붙여넣기
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              메시지를 통째로 복사해서 붙여넣으면 날짜와 플랫폼 실적을 자동 인식합니다.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-600">
            기준 연도
          </span>

          <input
            type="number"
            value={year}
            onChange={(
              event
            ) =>
              setYear(
                Number(
                  event.target
                    .value
                )
              )
            }
            className="w-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>

        <textarea
          value={text}
          onChange={(
            event
          ) =>
            setText(
              event.target.value
            )
          }
          placeholder="텔레그램 메시지를 여기에 그대로 붙여넣으세요."
          className="mt-4 min-h-[330px] w-full rounded-xl border border-zinc-200 p-4 text-sm leading-6 outline-none focus:border-blue-500"
        />

        <button
          type="button"
          onClick={analyze}
          disabled={
            loading ||
            !text.trim()
          }
          className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2
                size={17}
                className="animate-spin"
              />
              분석 중
            </>
          ) : (
            <>
              <ClipboardPaste
                size={17}
              />
              자동 분석
            </>
          )}
        </button>
      </section>

      {days.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold">
              인식 결과
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              저장 전에 숫자를 한 번 확인하세요.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            {days.map(
              (
                day,
                dayIndex
              ) => (
                <div
                  key={
                    day.date
                  }
                  className="rounded-xl border border-zinc-200"
                >
                  <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3">
                    <strong>
                      {formatDate(
                        day.date
                      )}
                    </strong>

                    {day
                      .warnings
                      .length ===
                    0 ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle2
                          size={
                            14
                          }
                        />
                        정상
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600">
                        <AlertTriangle
                          size={
                            14
                          }
                        />
                        확인 필요{" "}
                        {
                          day
                            .warnings
                            .length
                        }
                        건
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-zinc-400">
                          <th className="p-3">
                            플랫폼
                          </th>
                          <th className="p-3">
                            신청
                          </th>
                          <th className="p-3">
                            예약
                          </th>
                          <th className="p-3">
                            전환율
                          </th>
                          <th className="p-3">
                            원문
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {day.platforms.map(
                          (
                            row,
                            rowIndex
                          ) => {
                            const rate =
                              row.applications >
                              0
                                ? (row.reservations /
                                    row.applications) *
                                  100
                                : 0;

                            return (
                              <tr
                                key={`${day.date}-${row.platform}`}
                                className="border-b border-zinc-100"
                              >
                                <td className="p-3 font-semibold">
                                  {
                                    row.platform
                                  }
                                </td>

                                <td className="p-3">
                                  <input
                                    type="number"
                                    min={
                                      0
                                    }
                                    value={
                                      row.applications
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updatePlatform(
                                        dayIndex,
                                        rowIndex,
                                        "applications",
                                        Number(
                                          event
                                            .target
                                            .value
                                        )
                                      )
                                    }
                                    className="w-20 rounded-lg border px-2 py-1.5"
                                  />
                                </td>

                                <td className="p-3">
                                  <input
                                    type="number"
                                    min={
                                      0
                                    }
                                    value={
                                      row.reservations
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updatePlatform(
                                        dayIndex,
                                        rowIndex,
                                        "reservations",
                                        Number(
                                          event
                                            .target
                                            .value
                                        )
                                      )
                                    }
                                    className="w-20 rounded-lg border px-2 py-1.5"
                                  />
                                </td>

                                <td className="p-3 font-bold text-blue-700">
                                  {rate.toFixed(
                                    1
                                  )}
                                  %
                                </td>

                                <td className="p-3 text-xs text-zinc-400">
                                  {
                                    row.raw
                                  }
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>

                  {day.warnings
                    .length >
                    0 && (
                    <div className="space-y-2 bg-amber-50 px-4 py-3">
                      {day.warnings.map(
                        (
                          warning,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }
                            className="text-xs text-amber-700"
                          >
                            ⚠{" "}
                            {
                              warning.line
                            }{" "}
                            —{" "}
                            {
                              warning.reason
                            }
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={
              saving ||
              totalRows === 0
            }
            className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                저장 중
              </>
            ) : (
              <>
                <Save
                  size={17}
                />
                {days.length}
                일 ·{" "}
                {totalRows}
                건 저장
              </>
            )}
          </button>
        </section>
      )}

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {message}
        </div>
      )}
    </div>
  );
}
