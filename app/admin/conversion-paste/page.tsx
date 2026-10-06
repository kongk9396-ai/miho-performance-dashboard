"use client";

import { useMemo, useState } from "react";

import {
  parseConversionSheet,
  type ConversionParseResult,
} from "@/lib/conversion-paste-parser";

function percent(part: number, whole: number) {
  return whole > 0
    ? `${((part / whole) * 100).toFixed(2)}%`
    : "-";
}

function formatMonth(month: string) {
  const [year, value] = month.split("-");
  return `${year}년 ${Number(value)}월`;
}

export default function ConversionPastePage() {
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] =
    useState<ConversionParseResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    const days = result?.days ?? [];

    return {
      actualSurgeries: days.reduce(
        (sum, day) => sum + day.actualSurgeries,
        0
      ),
      consultations: days.reduce(
        (sum, day) => sum + day.consultations,
        0
      ),
      surgeries: days.reduce(
        (sum, day) => sum + day.surgeries,
        0
      ),
    };
  }, [result]);

  const otherMonthDays = useMemo(
    () =>
      (result?.days ?? []).filter(
        (day) => month && !day.date.startsWith(month)
      ),
    [result, month]
  );

  function analyze() {
    setError("");
    setMessage("");

    const parsed = parseConversionSheet(text, year);

    if (
      parsed.days.length === 0 &&
      parsed.doctors.length === 0
    ) {
      setResult(null);
      setError(
        "인식된 데이터가 없습니다. 구글 시트에서 표 영역을 그대로 복사해서 붙여넣어주세요."
      );
      return;
    }

    setResult(parsed);

    if (parsed.detectedMonth) {
      setMonth(parsed.detectedMonth);
    }
  }

  async function save() {
    if (!result || !month) {
      return;
    }

    const confirmed = window.confirm(
      `${formatMonth(month)} 데이터를 저장할까요?\n\n` +
        `· 일별 ${result.days.length}일: 같은 날짜는 덮어쓰기\n` +
        `· 원장 ${result.doctors.length}명: 이 달 기존 원장 데이터를 교체\n` +
        `· 월간 상담/수술 합계: 일별 합계로 다시 계산`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/conversion-paste/commit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            month,
            days: result.days,
            doctors: result.doctors,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ?? "저장에 실패했습니다."
        );
      }

      setMessage(data.message ?? "저장했습니다.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "저장에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1450px] px-6 py-10">
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
            상담 · 수술 전환 붙여넣기
          </h1>

          <p className="mt-2 text-zinc-500">
            구글 시트의 일별 상담 대비 수술 전환율 표와 원장님 표를
            복사해서 그대로 붙여넣으세요. 두 표를 한 번에 복사해도
            됩니다.
          </p>
        </div>

        <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-zinc-950">
                구글 시트 붙여넣기
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                전환율(%) 칸은 무시하고 저장할 때 다시 계산합니다. 빈
                날짜(휴무)는 건너뜁니다.
              </p>
            </div>

            <label className="block">
              <div className="mb-1 text-xs font-bold text-zinc-500">
                날짜에 연도가 없을 때 기준 연도
              </div>

              <select
                value={year}
                onChange={(event) =>
                  setYear(Number(event.target.value))
                }
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
              >
                {[
                  currentYear - 1,
                  currentYear,
                  currentYear + 1,
                ].map((item) => (
                  <option key={item} value={item}>
                    {item}년
                  </option>
                ))}
              </select>
            </label>
          </div>

          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setResult(null);
              setMessage("");
            }}
            placeholder={`구글 시트에서 표를 드래그해서 복사(Ctrl+C) 후 여기에 붙여넣기(Ctrl+V)

예)
일자\t수술 수\t상담\t수술 전환\t전환율\t\t원장님\t상담예약(DB포함)\t실상담\t수술결정
2026-09-01\t5\t15\t0\t0.00%
2026-09-02\t10\t4\t3\t75.00%\t\tS\t242\t128\t42`}
            className="min-h-[360px] w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 p-5 font-mono text-sm leading-7 text-zinc-800 outline-none transition focus:border-blue-500 focus:bg-white"
          />

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={analyze}
              disabled={!text.trim()}
              className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              분석하기
            </button>
          </div>
        </section>

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

        {result && (
          <>
            <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-5">
                <label className="block">
                  <div className="mb-1 text-xs font-bold text-zinc-500">
                    저장할 기준월
                  </div>

                  <input
                    type="month"
                    value={month}
                    onChange={(event) =>
                      setMonth(event.target.value)
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["수술 수", totals.actualSurgeries],
                    ["상담", totals.consultations],
                    ["수술 전환", totals.surgeries],
                    [
                      "전환율",
                      percent(
                        totals.surgeries,
                        totals.consultations
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl bg-zinc-50 px-5 py-3"
                    >
                      <div className="text-xs font-bold text-zinc-500">
                        {label}
                      </div>
                      <div className="mt-1 text-xl font-black text-zinc-950">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!month && (
                <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                  일별 날짜가 없어 기준월을 자동으로 정하지 못했습니다.
                  원장 데이터를 저장할 월을 선택해주세요.
                </div>
              )}

              {otherMonthDays.length > 0 && (
                <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  기준월과 다른 날짜가 있습니다:{" "}
                  {otherMonthDays
                    .map((day) => day.date)
                    .join(", ")}{" "}
                  — 한 번에 한 달씩 붙여넣어주세요.
                </div>
              )}

              {result.skippedDates.length > 0 && (
                <div className="mt-5 text-sm text-zinc-500">
                  빈 날짜 건너뜀:{" "}
                  {result.skippedDates
                    .map((date) => date.slice(5))
                    .join(", ")}
                </div>
              )}
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-black text-zinc-950">
                  일별 상담 대비 수술 전환 ({result.days.length}일)
                </h3>

                {result.days.length === 0 ? (
                  <div className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-400">
                    일별 데이터 없음
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                          <th className="px-3 py-3">일자</th>
                          <th className="px-3 py-3 text-right">수술 수</th>
                          <th className="px-3 py-3 text-right">상담</th>
                          <th className="px-3 py-3 text-right">수술 전환</th>
                          <th className="px-3 py-3 text-right">전환율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.days.map((day) => (
                          <tr
                            key={day.date}
                            className="border-b border-zinc-100"
                          >
                            <td className="px-3 py-2.5 font-semibold text-zinc-700">
                              {day.date}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              {day.actualSurgeries}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              {day.consultations}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              {day.surgeries}
                            </td>
                            <td className="px-3 py-2.5 text-right font-black text-blue-600">
                              {percent(
                                day.surgeries,
                                day.consultations
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-black text-zinc-950">
                  원장님별 수술 전환 ({result.doctors.length}명)
                </h3>

                {result.doctors.length === 0 ? (
                  <div className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-400">
                    원장 데이터 없음 (저장해도 기존 원장 데이터는
                    그대로 유지)
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                          <th className="px-3 py-3">원장님</th>
                          <th className="px-3 py-3 text-right">상담예약</th>
                          <th className="px-3 py-3 text-right">실상담</th>
                          <th className="px-3 py-3 text-right">수술결정</th>
                          <th className="px-3 py-3 text-right">예약→수술</th>
                          <th className="px-3 py-3 text-right">상담→수술</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.doctors.map((doctor) => (
                          <tr
                            key={doctor.doctorName}
                            className="border-b border-zinc-100"
                          >
                            <td className="px-3 py-2.5 font-black text-zinc-900">
                              {doctor.doctorName}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              {doctor.reservations}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              {doctor.consultations}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              {doctor.surgeries}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {percent(
                                doctor.surgeries,
                                doctor.reservations
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-black text-blue-600">
                              {percent(
                                doctor.surgeries,
                                doctor.consultations
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="sticky bottom-5 z-20 mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-xl backdrop-blur">
                <div>
                  <div className="font-black text-zinc-950">
                    숫자를 확인했나요?
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    저장하면 대시보드의 상담 대비 수술 전환 · 원장별 수술
                    전환율이 함께 갱신됩니다.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={save}
                  disabled={
                    saving ||
                    !month ||
                    otherMonthDays.length > 0
                  }
                  className="rounded-xl bg-zinc-950 px-7 py-3 font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {saving
                    ? "저장 중..."
                    : month
                      ? `${formatMonth(month)} 저장`
                      : "기준월 선택 필요"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}