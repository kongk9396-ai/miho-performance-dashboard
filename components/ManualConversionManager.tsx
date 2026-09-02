"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type DailyRow = {
  date: string;
  actualSurgeries: number;
  consultations: number;
  surgeries: number;
};

type DoctorRow = {
  doctorName: string;
  reservations: number;
  consultations: number;
  surgeries: number;
};

const DOCTORS = [
  "S",
  "J",
  "T",
];

function currentMonth() {
  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function daysInMonth(
  month: string
) {
  const [
    year,
    monthNumber,
  ] =
    month
      .split("-")
      .map(Number);

  return new Date(
    year,
    monthNumber,
    0
  ).getDate();
}

function createDailyRows(
  month: string,
  existing: DailyRow[] = []
) {
  const map =
    new Map(
      existing.map(
        (row) => [
          row.date,
          row,
        ]
      )
    );

  const count =
    daysInMonth(month);

  return Array.from(
    {
      length: count,
    },
    (_, index) => {
      const date =
        `${month}-${String(
          index + 1
        ).padStart(
          2,
          "0"
        )}`;

      const existingRow =
        map.get(date);

      return {
        date,

        actualSurgeries:
          Number(
            existingRow
              ?.actualSurgeries ??
              0
          ),

        consultations:
          Number(
            existingRow
              ?.consultations ??
              0
          ),

        surgeries:
          Number(
            existingRow
              ?.surgeries ??
              0
          ),
      };
    }
  );
}

function createDoctorRows(
  existing: DoctorRow[] = []
) {
  const map =
    new Map(
      existing.map(
        (row) => [
          row.doctorName,
          row,
        ]
      )
    );

  return DOCTORS.map(
    (doctorName) => {
      const row =
        map.get(
          doctorName
        );

      return {
        doctorName,

        reservations:
          Number(
            row?.reservations ??
              0
          ),

        consultations:
          Number(
            row?.consultations ??
              0
          ),

        surgeries:
          Number(
            row?.surgeries ??
              0
          ),
      };
    }
  );
}

function rate(
  numerator: number,
  denominator: number
) {
  if (
    denominator <= 0
  ) {
    return 0;
  }

  return (
    numerator /
    denominator *
    100
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange:
    (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={
        value === 0
          ? ""
          : value
      }
      placeholder="0"
      onChange={(event) => {
        const next =
          Number(
            event.target.value
          );

        onChange(
          Number.isFinite(next)
            ? Math.max(
                0,
                Math.round(
                  next
                )
              )
            : 0
        );
      }}
      className="
        w-full min-w-[72px]
        rounded-lg border border-zinc-200
        bg-white px-3 py-2
        text-right text-sm font-semibold
        outline-none
        transition
        focus:border-blue-500
        focus:ring-2
        focus:ring-blue-100
      "
    />
  );
}

export default function ManualConversionManager() {
  const [
    month,
    setMonth,
  ] =
    useState(
      currentMonth()
    );

  const [
    daily,
    setDaily,
  ] =
    useState<DailyRow[]>(
      []
    );

  const [
    doctors,
    setDoctors,
  ] =
    useState<DoctorRow[]>(
      createDoctorRows()
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    savingDaily,
    setSavingDaily,
  ] =
    useState(false);

  const [
    savingDoctors,
    setSavingDoctors,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setMessage("");

        try {
          const response =
            await fetch(
              `/api/admin/conversion/manual?month=${month}`,
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

          setDaily(
            createDailyRows(
              month,
              json.daily ??
                []
            )
          );

          setDoctors(
            createDoctorRows(
              json.doctors ??
                []
            )
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "불러오기 실패"
          );

          setDaily(
            createDailyRows(
              month
            )
          );

          setDoctors(
            createDoctorRows()
          );
        } finally {
          setLoading(false);
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
     월 합계
  ======================================================== */

  const totals =
    useMemo(
      () => {
        const actualSurgeries =
          daily.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.actualSurgeries,
            0
          );

        const consultations =
          daily.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.consultations,
            0
          );

        const surgeries =
          daily.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.surgeries,
            0
          );

        return {
          actualSurgeries,
          consultations,
          surgeries,
          conversionRate:
            rate(
              surgeries,
              consultations
            ),
        };
      },
      [
        daily,
      ]
    );


  /* ========================================================
     일별 저장
  ======================================================== */

  async function saveDaily() {
    setSavingDaily(
      true
    );

    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/conversion/manual",
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
                section:
                  "daily",
                daily,
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
        "일별 상담 대비 수술 전환 데이터를 저장했습니다."
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "저장 실패"
      );
    } finally {
      setSavingDaily(
        false
      );
    }
  }


  /* ========================================================
     원장별 저장
  ======================================================== */

  async function saveDoctors() {
    setSavingDoctors(
      true
    );

    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/conversion/manual",
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
                section:
                  "doctors",
                doctors,
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
        "원장별 수술 전환 데이터를 저장했습니다."
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "저장 실패"
      );
    } finally {
      setSavingDoctors(
        false
      );
    }
  }


  return (
    <div className="mx-auto max-w-[1500px] space-y-8 p-6 lg:p-8">

      {/* ====================================================
          상단
      ==================================================== */}

      <div
        className="
          flex flex-col gap-4
          lg:flex-row
          lg:items-center
          lg:justify-between
        "
      >
        <div>
          <h1 className="text-2xl font-black text-zinc-950">
            상담 / 수술 전환 직접 입력
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            다음달부터 일별 수술·상담·수술 결정과
            원장별 전환 데이터를 직접 입력합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-zinc-600">
            기준월
          </label>

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
            className="
              rounded-xl border
              border-zinc-200
              bg-white px-4 py-2.5
              text-sm font-bold
              outline-none
              focus:border-blue-500
            "
          />
        </div>
      </div>


      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {message}
        </div>
      )}


      {/* ====================================================
          일별 입력
      ==================================================== */}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        <div className="flex flex-col gap-4 border-b border-zinc-100 p-6 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <h2 className="text-lg font-black text-zinc-900">
              {month.replace(
                "-",
                "년 "
              )}월 상담 대비 수술 전환
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              전환율은 수술 결정 ÷ 상담으로 자동 계산됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={
              saveDaily
            }
            disabled={
              savingDaily ||
              loading
            }
            className="
              rounded-xl bg-blue-600
              px-5 py-3
              text-sm font-black
              text-white
              transition
              hover:bg-blue-700
              disabled:opacity-50
            "
          >
            {savingDaily
              ? "저장 중..."
              : "일별 데이터 저장"}
          </button>
        </div>


        {/* 월 합계 */}

        <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-5 lg:grid-cols-4">

          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-bold text-zinc-500">
              수술 수
            </p>
            <p className="mt-1 text-xl font-black">
              {totals.actualSurgeries.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-bold text-zinc-500">
              상담 수
            </p>
            <p className="mt-1 text-xl font-black">
              {totals.consultations.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-bold text-zinc-500">
              수술 결정
            </p>
            <p className="mt-1 text-xl font-black">
              {totals.surgeries.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-bold text-blue-600">
              수술 전환율
            </p>
            <p className="mt-1 text-xl font-black text-blue-600">
              {totals.conversionRate.toFixed(
                2
              )}
              %
            </p>
          </div>
        </div>


        <div className="overflow-x-auto">

          <table className="w-full min-w-[720px] border-collapse">

            <thead>
              <tr className="border-y border-zinc-200 bg-[#b8d3f5] text-sm font-black text-zinc-900">

                <th className="px-4 py-3 text-left">
                  일자
                </th>

                <th className="px-4 py-3 text-right">
                  수술 수
                </th>

                <th className="px-4 py-3 text-right">
                  상담
                </th>

                <th className="px-4 py-3 text-right">
                  수술 결정
                </th>

                <th className="px-4 py-3 text-right">
                  전환율
                </th>

              </tr>
            </thead>

            <tbody>
              {daily.map(
                (
                  row,
                  index
                ) => {
                  const rowRate =
                    rate(
                      row.surgeries,
                      row.consultations
                    );

                  return (
                    <tr
                      key={
                        row.date
                      }
                      className="
                        border-b
                        border-zinc-100
                        hover:bg-zinc-50
                      "
                    >
                      <td className="px-4 py-2.5 text-sm font-bold text-zinc-700">
                        {row.date}
                      </td>

                      <td className="px-3 py-2">
                        <NumberInput
                          value={
                            row.actualSurgeries
                          }
                          onChange={(
                            value
                          ) => {
                            setDaily(
                              (
                                previous
                              ) =>
                                previous.map(
                                  (
                                    item,
                                    itemIndex
                                  ) =>
                                    itemIndex ===
                                    index
                                      ? {
                                          ...item,
                                          actualSurgeries:
                                            value,
                                        }
                                      : item
                                )
                            );
                          }}
                        />
                      </td>

                      <td className="px-3 py-2">
                        <NumberInput
                          value={
                            row.consultations
                          }
                          onChange={(
                            value
                          ) => {
                            setDaily(
                              (
                                previous
                              ) =>
                                previous.map(
                                  (
                                    item,
                                    itemIndex
                                  ) =>
                                    itemIndex ===
                                    index
                                      ? {
                                          ...item,
                                          consultations:
                                            value,
                                        }
                                      : item
                                )
                            );
                          }}
                        />
                      </td>

                      <td className="px-3 py-2">
                        <NumberInput
                          value={
                            row.surgeries
                          }
                          onChange={(
                            value
                          ) => {
                            setDaily(
                              (
                                previous
                              ) =>
                                previous.map(
                                  (
                                    item,
                                    itemIndex
                                  ) =>
                                    itemIndex ===
                                    index
                                      ? {
                                          ...item,
                                          surgeries:
                                            value,
                                        }
                                      : item
                                )
                            );
                          }}
                        />
                      </td>

                      <td className="px-4 py-2.5 text-right text-sm font-black text-red-500">
                        {rowRate.toFixed(
                          2
                        )}
                        %
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>

          </table>
        </div>

      </section>



      {/* ====================================================
          원장별
      ==================================================== */}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        <div className="flex flex-col gap-4 border-b border-zinc-100 p-6 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <h2 className="text-lg font-black text-zinc-900">
              원장님별 수술 전환
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              상담예약 전환율과 실상담 전환율은 자동 계산됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={
              saveDoctors
            }
            disabled={
              savingDoctors ||
              loading
            }
            className="
              rounded-xl bg-zinc-900
              px-5 py-3
              text-sm font-black
              text-white
              transition
              hover:bg-black
              disabled:opacity-50
            "
          >
            {savingDoctors
              ? "저장 중..."
              : "원장별 데이터 저장"}
          </button>
        </div>


        <div className="overflow-x-auto">

          <table className="w-full min-w-[880px] border-collapse">

            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-sm font-black text-zinc-700">

                <th className="px-5 py-4 text-left">
                  원장님
                </th>

                <th className="px-4 py-4 text-right">
                  상담예약
                </th>

                <th className="px-4 py-4 text-right">
                  실상담
                </th>

                <th className="px-4 py-4 text-right">
                  수술 결정
                </th>

                <th className="px-4 py-4 text-right">
                  상담예약 전환율
                </th>

                <th className="px-4 py-4 text-right">
                  실상담 전환율
                </th>

              </tr>
            </thead>


            <tbody>
              {doctors.map(
                (
                  doctor,
                  index
                ) => {
                  const reservationRate =
                    rate(
                      doctor.surgeries,
                      doctor.reservations
                    );

                  const consultationRate =
                    rate(
                      doctor.surgeries,
                      doctor.consultations
                    );

                  return (
                    <tr
                      key={
                        doctor.doctorName
                      }
                      className="border-b border-zinc-100"
                    >

                      <td className="px-5 py-4 text-base font-black">
                        {doctor.doctorName}
                      </td>


                      <td className="px-3 py-3">
                        <NumberInput
                          value={
                            doctor.reservations
                          }
                          onChange={(
                            value
                          ) =>
                            setDoctors(
                              (
                                previous
                              ) =>
                                previous.map(
                                  (
                                    item,
                                    itemIndex
                                  ) =>
                                    itemIndex ===
                                    index
                                      ? {
                                          ...item,
                                          reservations:
                                            value,
                                        }
                                      : item
                                )
                            )
                          }
                        />
                      </td>


                      <td className="px-3 py-3">
                        <NumberInput
                          value={
                            doctor.consultations
                          }
                          onChange={(
                            value
                          ) =>
                            setDoctors(
                              (
                                previous
                              ) =>
                                previous.map(
                                  (
                                    item,
                                    itemIndex
                                  ) =>
                                    itemIndex ===
                                    index
                                      ? {
                                          ...item,
                                          consultations:
                                            value,
                                        }
                                      : item
                                )
                            )
                          }
                        />
                      </td>


                      <td className="px-3 py-3">
                        <NumberInput
                          value={
                            doctor.surgeries
                          }
                          onChange={(
                            value
                          ) =>
                            setDoctors(
                              (
                                previous
                              ) =>
                                previous.map(
                                  (
                                    item,
                                    itemIndex
                                  ) =>
                                    itemIndex ===
                                    index
                                      ? {
                                          ...item,
                                          surgeries:
                                            value,
                                        }
                                      : item
                                )
                            )
                          }
                        />
                      </td>


                      <td className="px-5 py-4 text-right font-black text-blue-600">
                        {reservationRate.toFixed(
                          2
                        )}
                        %
                      </td>


                      <td className="px-5 py-4 text-right font-black text-blue-600">
                        {consultationRate.toFixed(
                          2
                        )}
                        %
                      </td>

                    </tr>
                  );
                }
              )}
            </tbody>

          </table>
        </div>

      </section>

    </div>
  );
}
