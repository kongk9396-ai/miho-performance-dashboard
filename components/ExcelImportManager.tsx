"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

type PreviewMonth = {
  month: string;

  platforms: {
    platform: string;
    applications: number;
    reservations: number;
  }[];

  consultations: number | null;
  surgeries: number | null;

  totalApplications: number;
  totalReservations: number;

  reservationRate: number;
  surgeryRate: number | null;

  sources: string[];
  warnings: string[];
};

function formatMonth(value: string) {
  const [year, month] =
    value.split("-");

  return `${year}년 ${Number(month)}월`;
}

function formatPercent(
  value: number | null
) {
  if (value === null) return "-";

  return `${value.toFixed(2)}%`;
}


async function uploadConversionExcel(
  file: File
) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    "/api/admin/conversion-excel",
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      result.error ??
        "상담/수술 전환 데이터 업로드 실패"
    );
  }

  return result;
}

export default function ExcelImportManager() {
  const [files, setFiles] =
    useState<File[]>([]);

  const [months, setMonths] =
    useState<PreviewMonth[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [mode, setMode] =
    useState<"overwrite" | "skip">(
      "overwrite"
    );

  const [message, setMessage] =
    useState<string | null>(null);

  const [selectedMonths, setSelectedMonths] =
    useState<Set<string>>(new Set());

  const selectedData = useMemo(
    () =>
      months.filter((month) =>
        selectedMonths.has(month.month)
      ),
    [months, selectedMonths]
  );

  async function analyze() {
    if (!files.length) {
      setMessage(
        "엑셀 파일을 먼저 선택해주세요."
      );
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData =
        new FormData();

      for (const file of files) {
        formData.append(
          "files",
          file
        );
      }

      const response = await fetch(
        "/api/admin/import/preview",
        {
          method: "POST",
          body: formData,
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

      setMonths(result.months);

      setSelectedMonths(
        new Set(
          result.months.map(
            (month: PreviewMonth) =>
              month.month
          )
        )
      );

      setMessage(
        `${result.months.length}개월 데이터를 인식했습니다.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "엑셀 분석 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleMonth(
    month: string
  ) {
    setSelectedMonths((prev) => {
      const next =
        new Set(prev);

      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }

      return next;
    });
  }

  async function save() {
    if (!selectedData.length) {
      setMessage(
        "저장할 월을 선택해주세요."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `${selectedData.length}개월 데이터를 DB에 저장할까요?`
      );

    if (!confirmed) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/import/commit",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            months: selectedData,
            mode,
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
        "DB 저장 중 오류가 발생했습니다."
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
            <FileSpreadsheet
              size={22}
            />
          </div>

          <div>
            <h2 className="text-lg font-bold">
              기존 엑셀 일괄 가져오기
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              기존 파일을 수정하지
              않고 그대로 선택하세요.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={(event) =>
              setFiles(
                Array.from(
                  event.target.files ?? []
                )
              )
            }
            className="block w-full text-sm"
          />

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file) => (
                <div
                  key={
                    file.name +
                    file.size
                  }
                  className="flex items-center gap-2 text-sm text-zinc-600"
                >
                  <FileSpreadsheet
                    size={15}
                  />

                  {file.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={analyze}
          disabled={
            loading ||
            !files.length
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
              <Upload size={17} />
              파일 분석
            </>
          )}
        </button>
      </section>

      {months.length > 0 && (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-bold">
                  가져오기 미리보기
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  저장할 월만
                  체크하세요.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setSelectedMonths(
                      new Set(
                        months.map(
                          (item) =>
                            item.month
                        )
                      )
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-xs font-bold"
                >
                  전체 선택
                </button>

                <button
                  onClick={() =>
                    setSelectedMonths(
                      new Set()
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-xs font-bold"
                >
                  전체 해제
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[950px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                    <th className="p-3">
                      저장
                    </th>
                    <th className="p-3">
                      기준월
                    </th>
                    <th className="p-3 text-right">
                      신청
                    </th>
                    <th className="p-3 text-right">
                      예약
                    </th>
                    <th className="p-3 text-right">
                      예약률
                    </th>
                    <th className="p-3 text-right">
                      상담
                    </th>
                    <th className="p-3 text-right">
                      수술
                    </th>
                    <th className="p-3 text-right">
                      수술률
                    </th>
                    <th className="p-3">
                      플랫폼
                    </th>
                    <th className="p-3">
                      상태
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {months.map(
                    (month) => (
                      <tr
                        key={
                          month.month
                        }
                        className="border-b border-zinc-100"
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedMonths.has(
                              month.month
                            )}
                            onChange={() =>
                              toggleMonth(
                                month.month
                              )
                            }
                          />
                        </td>

                        <td className="p-3 font-bold">
                          {formatMonth(
                            month.month
                          )}
                        </td>

                        <td className="p-3 text-right">
                          {month.totalApplications.toLocaleString()}
                        </td>

                        <td className="p-3 text-right">
                          {month.totalReservations.toLocaleString()}
                        </td>

                        <td className="p-3 text-right font-semibold text-blue-700">
                          {formatPercent(
                            month.reservationRate
                          )}
                        </td>

                        <td className="p-3 text-right">
                          {month.consultations ??
                            "-"}
                        </td>

                        <td className="p-3 text-right">
                          {month.surgeries ??
                            "-"}
                        </td>

                        <td className="p-3 text-right">
                          {formatPercent(
                            month.surgeryRate
                          )}
                        </td>

                        <td className="p-3">
                          {
                            month
                              .platforms
                              .length
                          }
                          개
                        </td>

                        <td className="p-3">
                          {month
                            .warnings
                            .length ===
                          0 ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                              <CheckCircle2
                                size={14}
                              />
                              정상
                            </span>
                          ) : (
                            <span
                              title={month.warnings.join(
                                "\n"
                              )}
                              className="flex items-center gap-1 text-xs font-bold text-amber-600"
                            >
                              <AlertTriangle
                                size={14}
                              />
                              확인 필요
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold">
              기존 데이터 처리
            </h3>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-4">
                <input
                  type="radio"
                  checked={
                    mode ===
                    "overwrite"
                  }
                  onChange={() =>
                    setMode(
                      "overwrite"
                    )
                  }
                />

                <div>
                  <p className="text-sm font-bold">
                    기존 월 덮어쓰기
                  </p>
                  <p className="text-xs text-zinc-500">
                    같은 월이 있으면
                    엑셀 값으로 수정
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-4">
                <input
                  type="radio"
                  checked={
                    mode ===
                    "skip"
                  }
                  onChange={() =>
                    setMode("skip")
                  }
                />

                <div>
                  <p className="text-sm font-bold">
                    기존 월 건너뛰기
                  </p>
                  <p className="text-xs text-zinc-500">
                    이미 입력된 월은
                    유지
                  </p>
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={
                saving ||
                !selectedData.length
              }
              className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
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
                  <CheckCircle2
                    size={17}
                  />
                  선택한{" "}
                  {
                    selectedData.length
                  }
                  개월 DB에 저장
                </>
              )}
            </button>
          </section>
        </>
      )}

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {message}
        </div>
      )}
    </div>
  );
}