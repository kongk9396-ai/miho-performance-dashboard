"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  Loader2,
  Save,
} from "lucide-react";

const categories = [
  "코",
  "눈",
  "리프팅",
  "쁘띠",
];

type Row = {
  category: string;
  consultations: number;
  surgeries: number;
};

function getToday() {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    now.getTime() -
      offset
  )
    .toISOString()
    .slice(0, 10);
}

function makeEmptyRows(): Row[] {
  return categories.map(
    (category) => ({
      category,
      consultations: 0,
      surgeries: 0,
    })
  );
}

export default function CategoryConversionPage() {
  const [
    date,
    setDate,
  ] =
    useState(
      getToday()
    );

  const [
    rows,
    setRows,
  ] =
    useState<Row[]>(
      makeEmptyRows()
    );

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

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage("");

      try {
        const response =
          await fetch(
            `/api/admin/category-conversion?date=${encodeURIComponent(
              date
            )}`,
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
            result.message ??
              "조회 실패"
          );
        }

        const saved =
          Array.isArray(
            result.data
          )
            ? result.data
            : [];

        setRows(
          categories.map(
            (category) => {
              const found =
                saved.find(
                  (row: Row) =>
                    row.category ===
                    category
                );

              return {
                category,
                consultations:
                  found
                    ?.consultations ??
                  0,
                surgeries:
                  found
                    ?.surgeries ??
                  0,
              };
            }
          )
        );
      } catch (error) {
        console.error(
          error
        );

        setMessage(
          "데이터를 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [date]);

  function updateRow(
    index: number,
    field:
      | "consultations"
      | "surgeries",
    value: number
  ) {
    setRows(
      rows.map(
        (row, rowIndex) =>
          rowIndex ===
          index
            ? {
                ...row,
                [field]:
                  Math.max(
                    0,
                    value
                  ),
              }
            : row
      )
    );
  }

  async function save(
    event: FormEvent
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/category-conversion",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                date,
                rows,
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
          result.message ??
            "저장 실패"
        );
      }

      setMessage(
        "저장되었습니다."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "저장하지 못했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">
              카테고리별 상담 · 수술 입력
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              코 · 눈 · 리프팅 · 쁘띠
            </p>
          </div>

          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700"
          >
            <ArrowLeft
              size={16}
            />
            관리자
          </Link>
        </div>

        <form
          onSubmit={save}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-bold text-zinc-700">
            날짜
          </label>

          <input
            type="date"
            value={date}
            onChange={(
              event
            ) =>
              setDate(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3"
          />

          <div className="mt-6 space-y-4">
            {rows.map(
              (
                row,
                index
              ) => {
                const rate =
                  row.consultations >
                  0
                    ? (row.surgeries /
                        row.consultations) *
                      100
                    : 0;

                return (
                  <div
                    key={
                      row.category
                    }
                    className="grid gap-4 rounded-xl border border-zinc-100 bg-zinc-50 p-5 md:grid-cols-[120px_1fr_1fr_110px]"
                  >
                    <div className="flex items-center font-black text-zinc-900">
                      {
                        row.category
                      }
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-500">
                        상담
                      </label>

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
                            index,
                            "consultations",
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-500">
                        수술
                      </label>

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
                            index,
                            "surgeries",
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2"
                      />
                    </div>

                    <div className="flex items-center justify-end font-black text-blue-700">
                      {rate.toFixed(
                        1
                      )}
                      %
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {message && (
            <div className="mt-5 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={
              saving ||
              loading
            }
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <Save
                size={17}
              />
            )}

            저장
          </button>
        </form>
      </div>
    </main>
  );
}