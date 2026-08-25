"use client";

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const PLATFORMS = [
  "바비톡",
  "강남언니",
  "네이버",
  "플러스친구",
  "홈페이지",
  "인콜",
  "CPA",
];

type PlatformRow = {
  platform: string;
  applications: number;
  reservations: number;
};

type ManagerRow = {
  managerName: string;
  consultations: number;
  surgeries: number;
  revenue: number;
};

function createEmptyPlatforms(): PlatformRow[] {
  return PLATFORMS.map((platform) => ({
    platform,
    applications: 0,
    reservations: 0,
  }));
}

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function monthInputToDb(value: string) {
  return `${value}-01`;
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.00%";

  return `${value.toFixed(2)}%`;
}

export default function AdminMonthlyForm() {
  const [month, setMonth] = useState(getCurrentMonth());

  const [platforms, setPlatforms] =
    useState<PlatformRow[]>(createEmptyPlatforms());

  const [consultations, setConsultations] = useState(0);
  const [surgeries, setSurgeries] = useState(0);

  const [managers, setManagers] = useState<ManagerRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [exists, setExists] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const totalApplications = useMemo(
    () =>
      platforms.reduce(
        (sum, row) => sum + Number(row.applications || 0),
        0
      ),
    [platforms]
  );

  const totalReservations = useMemo(
    () =>
      platforms.reduce(
        (sum, row) => sum + Number(row.reservations || 0),
        0
      ),
    [platforms]
  );

  const reservationRate =
    totalApplications > 0
      ? (totalReservations / totalApplications) * 100
      : 0;

  const surgeryRate =
    consultations > 0 ? (surgeries / consultations) * 100 : 0;

  const totalManagerRevenue = useMemo(
    () =>
      managers.reduce(
        (sum, manager) => sum + Number(manager.revenue || 0),
        0
      ),
    [managers]
  );

  const loadMonth = useCallback(async () => {
    if (!month) return;

    setLoading(true);
    setMessage(null);

    try {
      const dbMonth = monthInputToDb(month);

      const response = await fetch(
        `/api/admin/monthly-stats?month=${dbMonth}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "데이터를 불러오지 못했습니다."
        );
      }

      setExists(Boolean(result.exists));

      const loadedPlatforms = createEmptyPlatforms().map(
        (defaultRow) => {
          const found = result.data.platforms.find(
            (row: PlatformRow) =>
              row.platform === defaultRow.platform
          );

          return found ?? defaultRow;
        }
      );

      setPlatforms(loadedPlatforms);

      setConsultations(
        Number(result.data.consultations ?? 0)
      );

      setSurgeries(Number(result.data.surgeries ?? 0));

      setManagers(
        (result.data.managers ?? []).map(
          (manager: ManagerRow) => ({
            managerName: manager.managerName,
            consultations: Number(manager.consultations ?? 0),
            surgeries: Number(manager.surgeries ?? 0),
            revenue: Number(manager.revenue ?? 0),
          })
        )
      );
    } catch (error) {
      console.error(error);

      setExists(false);
      setPlatforms(createEmptyPlatforms());
      setConsultations(0);
      setSurgeries(0);
      setManagers([]);

      setMessage({
        type: "error",
        text: "월 데이터를 불러오지 못했습니다.",
      });
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  function updatePlatform(
    index: number,
    field: "applications" | "reservations",
    value: number
  ) {
    setPlatforms((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: Math.max(0, value || 0),
            }
          : row
      )
    );
  }

  function addManager() {
    setManagers((prev) => [
      ...prev,
      {
        managerName: "",
        consultations: 0,
        surgeries: 0,
        revenue: 0,
      },
    ]);
  }

  function updateManager(
    index: number,
    field: keyof ManagerRow,
    value: string | number
  ) {
    setManagers((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  function removeManager(index: number) {
    setManagers((prev) =>
      prev.filter((_, rowIndex) => rowIndex !== index)
    );
  }

  async function save() {
    if (!month) {
      setMessage({
        type: "error",
        text: "기준월을 선택해주세요.",
      });

      return;
    }

    const duplicatedManagers = managers
      .map((manager) => manager.managerName.trim())
      .filter(Boolean);

    if (
      new Set(duplicatedManagers).size !==
      duplicatedManagers.length
    ) {
      setMessage({
        type: "error",
        text: "같은 실장명이 중복되어 있습니다.",
      });

      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/monthly-stats",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            month: monthInputToDb(month),
            platforms,
            consultations,
            surgeries,
            managers,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "저장하지 못했습니다."
        );
      }

      setExists(true);

      setMessage({
        type: "success",
        text: "저장 완료! 대시보드에 반영되었습니다.",
      });

      await loadMonth();
    } catch (error) {
      console.error(error);

      setMessage({
        type: "error",
        text: "저장 중 오류가 발생했습니다.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={28}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-zinc-500">
            월 데이터를 불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 월 선택 */}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays
                size={19}
                className="text-blue-600"
              />

              <h2 className="text-lg font-bold">
                기준월 선택
              </h2>
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              기존 월을 선택하면 저장된 값이 자동으로
              불러와집니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={month}
              onChange={(event) =>
                setMonth(event.target.value)
              }
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            />

            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                exists
                  ? "bg-blue-50 text-blue-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {exists ? "기존 데이터 수정" : "신규 입력"}
            </span>
          </div>
        </div>
      </section>

      {/* 실시간 미리보기 */}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="총 신청"
          value={totalApplications.toLocaleString("ko-KR")}
        />

        <SummaryCard
          label="총 예약"
          value={totalReservations.toLocaleString("ko-KR")}
        />

        <SummaryCard
          label="예약 전환율"
          value={formatPercent(reservationRate)}
        />

        <SummaryCard
          label="상담 → 수술 전환율"
          value={formatPercent(surgeryRate)}
        />
      </section>

      {/* 플랫폼 */}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <BarChart3
              size={19}
              className="text-blue-600"
            />

            <h2 className="text-lg font-bold">
              플랫폼 실적
            </h2>
          </div>

          <p className="mt-2 text-sm text-zinc-500">
            신청과 예약 숫자만 입력하세요. 전환율과
            전체 합계는 자동 계산됩니다.
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 border-b border-zinc-100 px-3 pb-3 text-xs font-semibold text-zinc-400">
              <span>플랫폼</span>
              <span>신청</span>
              <span>예약</span>
              <span>예약 전환율</span>
            </div>

            <div className="divide-y divide-zinc-100">
              {platforms.map((row, index) => {
                const rate =
                  row.applications > 0
                    ? (row.reservations /
                        row.applications) *
                      100
                    : 0;

                return (
                  <div
                    key={row.platform}
                    className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center gap-3 px-3 py-4"
                  >
                    <div>
                      <span className="font-semibold">
                        {row.platform}
                      </span>

                      {row.platform === "인콜" && (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-500">
                          전체 합계 포함
                        </span>
                      )}
                    </div>

                    <NumberInput
                      value={row.applications}
                      onChange={(value) =>
                        updatePlatform(
                          index,
                          "applications",
                          value
                        )
                      }
                    />

                    <NumberInput
                      value={row.reservations}
                      onChange={(value) =>
                        updatePlatform(
                          index,
                          "reservations",
                          value
                        )
                      }
                    />

                    <span className="font-bold text-blue-700">
                      {formatPercent(rate)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 상담 / 수술 */}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-bold">
            상담 · 수술 전환
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            병원 전체 상담 및 수술 전환 실적입니다.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <FieldBlock label="총 상담">
            <NumberInput
              value={consultations}
              onChange={setConsultations}
            />
          </FieldBlock>

          <FieldBlock label="수술 전환">
            <NumberInput
              value={surgeries}
              onChange={setSurgeries}
            />
          </FieldBlock>
        </div>

        <div className="mt-5 rounded-xl bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-500">
            상담 → 수술 전환율
          </p>

          <p className="mt-1 text-2xl font-bold text-blue-700">
            {formatPercent(surgeryRate)}
          </p>
        </div>
      </section>

      {/* 실장 실적 */}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Users
                size={19}
                className="text-violet-600"
              />

              <h2 className="text-lg font-bold">
                실장별 실적
              </h2>
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              관리자 계정에서만 조회할 매출 및 전환
              데이터입니다.
            </p>
          </div>

          <button
            type="button"
            onClick={addManager}
            className="flex w-fit items-center gap-2 rounded-xl bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100"
          >
            <Plus size={16} />
            실장 추가
          </button>
        </div>

        {managers.length === 0 ? (
          <button
            type="button"
            onClick={addManager}
            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-10 text-zinc-400"
          >
            <Plus size={22} />

            <span className="mt-2 text-sm font-semibold">
              실장 실적 추가
            </span>
          </button>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[1.3fr_1fr_1fr_1.4fr_1fr_50px] gap-3 border-b border-zinc-100 px-2 pb-3 text-xs font-semibold text-zinc-400">
                <span>실장명</span>
                <span>상담</span>
                <span>수술</span>
                <span>매출</span>
                <span>수술 전환율</span>
                <span />
              </div>

              <div className="divide-y divide-zinc-100">
                {managers.map((manager, index) => {
                  const managerRate =
                    manager.consultations > 0
                      ? (manager.surgeries /
                          manager.consultations) *
                        100
                      : 0;

                  return (
                    <div
                      key={index}
                      className="grid grid-cols-[1.3fr_1fr_1fr_1.4fr_1fr_50px] items-center gap-3 px-2 py-4"
                    >
                      <input
                        value={manager.managerName}
                        onChange={(event) =>
                          updateManager(
                            index,
                            "managerName",
                            event.target.value
                          )
                        }
                        placeholder="실장명"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                      />

                      <NumberInput
                        value={manager.consultations}
                        onChange={(value) =>
                          updateManager(
                            index,
                            "consultations",
                            value
                          )
                        }
                      />

                      <NumberInput
                        value={manager.surgeries}
                        onChange={(value) =>
                          updateManager(
                            index,
                            "surgeries",
                            value
                          )
                        }
                      />

                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          value={manager.revenue}
                          onChange={(event) =>
                            updateManager(
                              index,
                              "revenue",
                              Math.max(
                                0,
                                Number(event.target.value) || 0
                              )
                            )
                          }
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 pr-8 text-sm outline-none focus:border-violet-400"
                        />

                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                          원
                        </span>
                      </div>

                      <span className="font-bold text-violet-700">
                        {formatPercent(managerRate)}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeManager(index)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex justify-end rounded-xl bg-violet-50 px-5 py-4">
                <div className="text-right">
                  <p className="text-xs font-semibold text-violet-500">
                    실장 매출 합계
                  </p>

                  <p className="mt-1 text-xl font-bold text-violet-800">
                    {formatWon(totalManagerRevenue)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 상태 */}

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {message.type === "success" && (
            <CheckCircle2 size={17} />
          )}

          {message.text}
        </div>
      )}

      {/* 저장 */}

      <div className="sticky bottom-4 z-20">
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-xl backdrop-blur md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold">
              {month.replace("-", "년 ")}월 실적
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              저장하면 전체 대시보드와 관리자 실적에
              반영됩니다.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-600"
            >
              <ChevronLeft size={16} />
              대시보드
            </a>

            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <Save size={17} />
                  {exists ? "수정 저장" : "신규 저장"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(event) =>
        onChange(
          Math.max(0, Number(event.target.value) || 0)
        )
      }
      className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
    />
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-zinc-600">
        {label}
      </p>

      {children}
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-zinc-950">
        {value}
      </p>
    </div>
  );
}