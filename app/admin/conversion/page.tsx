"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
} from "lucide-react";

type ConversionRow = {
  id: number;
  date: string;
  consultations: number;
  surgeries: number;
};

function getToday() {
  const now = new Date();
  const offset =
    now.getTimezoneOffset() * 60 * 1000;

  return new Date(
    now.getTime() - offset
  )
    .toISOString()
    .slice(0, 10);
}

export default function ConversionAdminPage() {
  const [date, setDate] =
    useState(getToday());

  const [
    consultations,
    setConsultations,
  ] = useState("0");

  const [
    surgeries,
    setSurgeries,
  ] = useState("0");

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const consultationCount =
    Number(consultations) || 0;

  const surgeryCount =
    Number(surgeries) || 0;

  const rate =
    consultationCount > 0
      ? (surgeryCount /
          consultationCount) *
        100
      : 0;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage("");

      try {
        const response =
          await fetch(
            `/api/admin/conversion?date=${encodeURIComponent(
              date
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
              "데이터 조회 실패"
          );
        }

        const row =
          result.data as
            | ConversionRow
            | null;

        if (row) {
          setConsultations(
            String(
              row.consultations
            )
          );

          setSurgeries(
            String(row.surgeries)
          );
        } else {
          setConsultations("0");
          setSurgeries("0");
        }
      } catch (error) {
        console.error(error);

        setMessage(
          "데이터를 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [date]);

  async function save(
    event: FormEvent
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/conversion",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                date,
                consultations:
                  consultationCount,
                surgeries:
                  surgeryCount,
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
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">
              일별 상담 → 수술 전환
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              날짜별 상담 건수와 수술 결정 건수를 입력합니다.
            </p>
          </div>

          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft size={16} />
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
            onChange={(event) =>
              setDate(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-blue-500"
          />

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-zinc-700">
                상담 건수
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={consultations}
                onChange={(event) =>
                  setConsultations(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700">
                수술 결정 건수
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={surgeries}
                onChange={(event) =>
                  setSurgeries(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-blue-50 p-5">
            <div className="text-sm font-bold text-blue-700">
              상담 → 수술 전환율
            </div>

            <div className="mt-1 text-3xl font-black text-blue-900">
              {rate.toFixed(1)}%
            </div>

            <div className="mt-1 text-xs text-blue-600">
              {surgeryCount}건 ÷{" "}
              {consultationCount}건
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={
              saving || loading
            }
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <Save size={17} />
            )}

            저장
          </button>
        </form>
      </div>
    </main>
  );
}