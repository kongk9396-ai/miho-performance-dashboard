
"use client";

import {
  BarChart3,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import {
  useEffect,
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

type PerformanceData = {
  month: string;

  summary: {
    consultations: number;
    surgeries: number;
    conversionRate: number;
    revenue: number;
  };

  managers: ManagerRow[];
};

function money(
  value: number
) {
  return new Intl.NumberFormat(
    "ko-KR"
  ).format(value);
}

function monthLabel(
  month: string
) {
  const [
    year,
    monthNumber,
  ] =
    month
      .slice(0, 7)
      .split("-");

  return `${year}년 ${Number(
    monthNumber
  )}월`;
}

export default function AdminPerformanceDashboard({
  initialMonth,
}: {
  initialMonth: string;
}) {
  const [
    selectedMonth,
    setSelectedMonth,
  ] =
    useState(
      initialMonth
    );

  const [
    data,
    setData,
  ] =
    useState<PerformanceData | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  async function load(
    month: string
  ) {
    setLoading(true);

    try {
      const response =
        await fetch(
          `/api/admin/performance?month=${encodeURIComponent(
            month
          )}&t=${Date.now()}`,
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
          result.message
        );
      }

      setData(
        result.data
      );
    } catch (error) {
      console.error(
        error
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(
      selectedMonth
    );
  }, [selectedMonth]);

  const now =
    new Date();

  const months =
    Array.from(
      {
        length: 36,
      },
      (_, index) => {
        const date =
          new Date(
            now.getFullYear(),
            now.getMonth() -
              index,
            1
          );

        return `${date.getFullYear()}-${String(
          date.getMonth() +
            1
        ).padStart(
          2,
          "0"
        )}-01`;
      }
    );

  return (
    <div className="space-y-6">
      {/* 상단 */}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            ADMIN
          </p>

          <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-900">
            실장별 실적 · 매출
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            상담, 수술, 전환율과 매출을 월별로 비교합니다.
          </p>
        </div>

        <select
          value={
            selectedMonth
          }
          onChange={(
            event
          ) =>
            setSelectedMonth(
              event.target
                .value
            )
          }
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm outline-none"
        >
          {months.map(
            (month) => (
              <option
                key={
                  month
                }
                value={
                  month
                }
              >
                {monthLabel(
                  month
                )}
              </option>
            )
          )}
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" />
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          데이터를 불러오지 못했습니다.
        </div>
      ) : (
        <>
          {/* KPI */}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={
                <Users
                  size={
                    18
                  }
                />
              }
              label="총 상담"
              value={`${data.summary.consultations.toLocaleString(
                "ko-KR"
              )}건`}
            />

            <Kpi
              icon={
                <BarChart3
                  size={
                    18
                  }
                />
              }
              label="총 수술"
              value={`${data.summary.surgeries.toLocaleString(
                "ko-KR"
              )}건`}
            />

            <Kpi
              icon={
                <TrendingUp
                  size={
                    18
                  }
                />
              }
              label="수술 전환율"
              value={`${data.summary.conversionRate.toFixed(
                1
              )}%`}
            />

            <Kpi
              icon={
                <Wallet
                  size={
                    18
                  }
                />
              }
              label="총 매출"
              value={`${money(
                data.summary
                  .revenue
              )}원`}
            />
          </div>

          {/* 실장 테이블 */}

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-6 py-5">
              <h2 className="font-bold">
                {monthLabel(
                  data.month
                )}{" "}
                실장별 실적
              </h2>
            </div>

            {data.managers
              .length ===
            0 ? (
              <div className="p-12 text-center text-sm text-zinc-400">
                해당 월의 실장별 데이터가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs text-zinc-500">
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
                    {data.managers.map(
                      (
                        manager
                      ) => (
                        <tr
                          key={
                            manager.managerId
                          }
                          className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                        >
                          <td className="px-6 py-5 font-bold">
                            {
                              manager.managerName
                            }
                          </td>

                          <td className="px-4 py-5 text-right">
                            {manager.consultations.toLocaleString(
                              "ko-KR"
                            )}
                          </td>

                          <td className="px-4 py-5 text-right font-bold text-blue-600">
                            {manager.surgeries.toLocaleString(
                              "ko-KR"
                            )}
                          </td>

                          <td className="px-4 py-5 text-right font-bold">
                            {manager.conversionRate.toFixed(
                              1
                            )}
                            %
                          </td>

                          <td className="px-6 py-5 text-right font-bold">
                            {money(
                              manager.revenue
                            )}
                            원
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 매출 비교 */}

          {data.managers
            .length >
            0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-6 font-bold">
                실장별 매출 비교
              </h2>

              <div className="space-y-5">
                {data.managers.map(
                  (
                    manager
                  ) => {
                    const maxRevenue =
                      Math.max(
                        ...data.managers.map(
                          (
                            row
                          ) =>
                            row.revenue
                        ),
                        1
                      );

                    const width =
                      (manager.revenue /
                        maxRevenue) *
                      100;

                    return (
                      <div
                        key={
                          manager.managerId
                        }
                      >
                        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                          <strong>
                            {
                              manager.managerName
                            }
                          </strong>

                          <strong>
                            {money(
                              manager.revenue
                            )}
                            원
                          </strong>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{
                              width: `${width}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon:
    React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}

        <span className="text-xs font-semibold">
          {label}
        </span>
      </div>

      <p className="mt-3 text-2xl font-black tracking-tight">
        {value}
      </p>
    </div>
  );
}