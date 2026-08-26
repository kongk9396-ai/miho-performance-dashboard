"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Platform = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  includeInTotal: boolean;
  includeInChannelChart: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type PlatformsResponse = {
  ok: boolean;
  message?: string;
  platforms?: Platform[];
  platform?: Platform;
};

function safeNumber(value: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(number)
  );
}

export default function PlatformsPage() {
  const [
    platforms,
    setPlatforms,
  ] = useState<Platform[]>([]);

  const [
    newName,
    setNewName,
  ] = useState("");

  const [
    newIncludeInTotal,
    setNewIncludeInTotal,
  ] = useState(true);

  const [
    newIncludeInChannelChart,
    setNewIncludeInChannelChart,
  ] = useState(true);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    savingId,
    setSavingId,
  ] = useState<number | null>(
    null
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  /*
  =========================================
  SUMMARY
  =========================================
  */

  const activeCount =
    useMemo(
      () =>
        platforms.filter(
          (platform) =>
            platform.isActive
        ).length,
      [platforms]
    );

  const totalIncludedCount =
    useMemo(
      () =>
        platforms.filter(
          (platform) =>
            platform.isActive &&
            platform.includeInTotal
        ).length,
      [platforms]
    );

  const chartIncludedCount =
    useMemo(
      () =>
        platforms.filter(
          (platform) =>
            platform.isActive &&
            platform.includeInChannelChart
        ).length,
      [platforms]
    );

  /*
  =========================================
  LOAD
  =========================================
  */

  const loadPlatforms =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/admin/platforms",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const result =
          (await response.json()) as PlatformsResponse;

        if (
          !response.ok ||
          !result.ok
        ) {
          throw new Error(
            result.message ??
              "플랫폼 목록을 불러오지 못했습니다."
          );
        }

        setPlatforms(
          result.platforms ?? []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "플랫폼 목록을 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

  /*
  =========================================
  ADD
  =========================================
  */

  async function addPlatform() {
    const name =
      newName.trim();

    if (!name) {
      setError(
        "추가할 플랫폼 이름을 입력해주세요."
      );

      return;
    }

    setAdding(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/platforms",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name,

              includeInTotal:
                newIncludeInTotal,

              includeInChannelChart:
                newIncludeInChannelChart,
            }),
          }
        );

      const result =
        (await response.json()) as PlatformsResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "플랫폼 추가에 실패했습니다."
        );
      }

      setNewName("");
      setNewIncludeInTotal(true);
      setNewIncludeInChannelChart(
        true
      );

      await loadPlatforms();

      setMessage(
        result.message ??
          `${name} 플랫폼을 추가했습니다.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "플랫폼 추가에 실패했습니다."
      );
    } finally {
      setAdding(false);
    }
  }

  /*
  =========================================
  LOCAL EDIT
  =========================================
  */

  function updateLocal(
    id: number,
    field:
      | "name"
      | "sortOrder",
    value: string
  ) {
    setPlatforms(
      (current) =>
        current.map(
          (platform) =>
            platform.id === id
              ? {
                  ...platform,

                  [field]:
                    field ===
                    "sortOrder"
                      ? safeNumber(
                          value
                        )
                      : value,
                }
              : platform
        )
    );

    setMessage("");
  }

  /*
  =========================================
  SAVE NAME / ORDER
  =========================================
  */

  async function savePlatform(
    platform: Platform
  ) {
    const name =
      platform.name.trim();

    if (!name) {
      setError(
        "플랫폼 이름은 비워둘 수 없습니다."
      );

      return;
    }

    setSavingId(
      platform.id
    );

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/platforms",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id: platform.id,
              name,
              sortOrder:
                platform.sortOrder,

              isActive:
                platform.isActive,

              includeInTotal:
                platform.includeInTotal,

              includeInChannelChart:
                platform.includeInChannelChart,
            }),
          }
        );

      const result =
        (await response.json()) as PlatformsResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "플랫폼 저장에 실패했습니다."
        );
      }

      await loadPlatforms();

      setMessage(
        `${name} 플랫폼 정보를 저장했습니다.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "플랫폼 저장에 실패했습니다."
      );
    } finally {
      setSavingId(null);
    }
  }

  /*
  =========================================
  PATCH SINGLE FIELD
  =========================================
  */

  async function patchField(
    platform: Platform,
    field:
      | "isActive"
      | "includeInTotal"
      | "includeInChannelChart",
    value: boolean
  ) {
    setSavingId(
      platform.id
    );

    setError("");
    setMessage("");

    /*
      화면은 먼저 변경해서
      토글 반응을 즉시 보여준다.
    */

    setPlatforms(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            platform.id
              ? {
                  ...item,
                  [field]:
                    value,
                }
              : item
        )
    );

    try {
      const response =
        await fetch(
          "/api/admin/platforms",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id:
                platform.id,

              [field]:
                value,
            }),
          }
        );

      const result =
        (await response.json()) as PlatformsResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "플랫폼 설정 변경에 실패했습니다."
        );
      }

      setMessage(
        `${platform.name} 설정을 변경했습니다.`
      );

      await loadPlatforms();

      setMessage(
        `${platform.name} 설정을 변경했습니다.`
      );
    } catch (err) {
      /*
        실패하면 서버 상태로 복구
      */

      await loadPlatforms();

      setError(
        err instanceof Error
          ? err.message
          : "플랫폼 설정 변경에 실패했습니다."
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1350px] px-6 py-10">

        {/* HEADER */}

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
            플랫폼 관리
          </h1>

          <p className="mt-2 text-zinc-500">
            DB 유입 플랫폼과 대시보드 집계
            방식을 관리합니다.
          </p>
        </div>

        {/* SUMMARY */}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            label="전체 플랫폼"
            value={platforms.length}
          />

          <SummaryCard
            label="활성 플랫폼"
            value={activeCount}
          />

          <SummaryCard
            label="합계 포함"
            value={totalIncludedCount}
          />

          <SummaryCard
            label="채널 차트 포함"
            value={chartIncludedCount}
          />

        </section>

        {/* ADD */}

        <section className="mb-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

          <div>
            <h2 className="text-lg font-black text-zinc-950">
              새 플랫폼 추가
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              홈페이지, 메타, CPA 등 새로운
              DB 유입 채널을 추가할 수 있습니다.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(250px,1fr)_180px_180px_auto] lg:items-end">

            {/* 이름 */}

            <label>
              <div className="mb-2 text-xs font-bold text-zinc-500">
                플랫폼명
              </div>

              <input
                type="text"
                value={newName}
                onChange={(
                  event
                ) =>
                  setNewName(
                    event.target.value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    void addPlatform();
                  }
                }}
                placeholder="예: 메타"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-bold outline-none focus:border-blue-500 focus:bg-white"
              />
            </label>

            {/* 합계 */}

            <label className="flex h-[50px] cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-4">

              <input
                type="checkbox"
                checked={
                  newIncludeInTotal
                }
                onChange={(
                  event
                ) =>
                  setNewIncludeInTotal(
                    event.target
                      .checked
                  )
                }
                className="h-4 w-4"
              />

              <span className="text-sm font-bold text-zinc-700">
                전체 합계 포함
              </span>

            </label>

            {/* 차트 */}

            <label className="flex h-[50px] cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-4">

              <input
                type="checkbox"
                checked={
                  newIncludeInChannelChart
                }
                onChange={(
                  event
                ) =>
                  setNewIncludeInChannelChart(
                    event.target
                      .checked
                  )
                }
                className="h-4 w-4"
              />

              <span className="text-sm font-bold text-zinc-700">
                채널 차트 포함
              </span>

            </label>

            <button
              type="button"
              onClick={
                addPlatform
              }
              disabled={
                adding ||
                !newName.trim()
              }
              className="h-[50px] rounded-xl bg-blue-600 px-7 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {adding
                ? "추가 중..."
                : "플랫폼 추가"}
            </button>

          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-bold text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-bold text-emerald-700">
            {message}
          </div>
        )}

        {/* PLATFORM LIST */}

        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">

          <div className="border-b border-zinc-200 px-6 py-5">

            <h2 className="text-xl font-black text-zinc-950">
              등록된 플랫폼
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              플랫폼을 비활성화해도 기존
              일별·월별 데이터는 삭제되지 않습니다.
            </p>

          </div>

          {loading ? (
            <div className="p-16 text-center font-bold text-zinc-400">
              플랫폼 목록을 불러오는 중...
            </div>
          ) : platforms.length ===
            0 ? (
            <div className="p-16 text-center font-bold text-zinc-500">
              등록된 플랫폼이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1050px] border-collapse">

                <thead>
                  <tr className="bg-zinc-50 text-left text-xs font-black text-zinc-500">

                    <th className="px-6 py-4">
                      플랫폼
                    </th>

                    <th className="px-4 py-4 text-center">
                      순서
                    </th>

                    <th className="px-4 py-4 text-center">
                      활성
                    </th>

                    <th className="px-4 py-4 text-center">
                      전체 합계
                    </th>

                    <th className="px-4 py-4 text-center">
                      채널 차트
                    </th>

                    <th className="px-6 py-4 text-right">
                      관리
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {platforms.map(
                    (platform) => (
                      <tr
                        key={
                          platform.id
                        }
                        className={`border-t border-zinc-100 ${
                          platform.isActive
                            ? ""
                            : "bg-zinc-50 opacity-60"
                        }`}
                      >

                        {/* NAME */}

                        <td className="px-6 py-5">

                          <input
                            type="text"
                            value={
                              platform.name
                            }
                            onChange={(
                              event
                            ) =>
                              updateLocal(
                                platform.id,
                                "name",
                                event.target
                                  .value
                              )
                            }
                            className="w-full min-w-[180px] rounded-xl border border-zinc-200 bg-white px-4 py-2.5 font-black text-zinc-900 outline-none focus:border-blue-500"
                          />

                        </td>

                        {/* ORDER */}

                        <td className="px-4 py-5">

                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              platform.sortOrder
                            }
                            onChange={(
                              event
                            ) =>
                              updateLocal(
                                platform.id,
                                "sortOrder",
                                event.target
                                  .value
                              )
                            }
                            className="mx-auto block w-20 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-center font-bold outline-none focus:border-blue-500"
                          />

                        </td>

                        {/* ACTIVE */}

                        <td className="px-4 py-5 text-center">

                          <ToggleButton
                            active={
                              platform.isActive
                            }
                            disabled={
                              savingId ===
                              platform.id
                            }
                            activeText="활성"
                            inactiveText="비활성"
                            onClick={() =>
                              void patchField(
                                platform,
                                "isActive",
                                !platform.isActive
                              )
                            }
                          />

                        </td>

                        {/* TOTAL */}

                        <td className="px-4 py-5 text-center">

                          <ToggleButton
                            active={
                              platform.includeInTotal
                            }
                            disabled={
                              savingId ===
                              platform.id
                            }
                            activeText="포함"
                            inactiveText="제외"
                            onClick={() =>
                              void patchField(
                                platform,
                                "includeInTotal",
                                !platform.includeInTotal
                              )
                            }
                          />

                        </td>

                        {/* CHART */}

                        <td className="px-4 py-5 text-center">

                          <ToggleButton
                            active={
                              platform.includeInChannelChart
                            }
                            disabled={
                              savingId ===
                              platform.id
                            }
                            activeText="포함"
                            inactiveText="제외"
                            onClick={() =>
                              void patchField(
                                platform,
                                "includeInChannelChart",
                                !platform.includeInChannelChart
                              )
                            }
                          />

                        </td>

                        {/* SAVE */}

                        <td className="px-6 py-5 text-right">

                          <button
                            type="button"
                            onClick={() =>
                              void savePlatform(
                                platform
                              )
                            }
                            disabled={
                              savingId ===
                              platform.id
                            }
                            className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-black disabled:bg-zinc-400"
                          >
                            {savingId ===
                            platform.id
                              ? "처리 중..."
                              : "저장"}
                          </button>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* 설명 */}

        <section className="mt-6 grid gap-4 md:grid-cols-3">

          <InfoCard
            title="활성"
            description="현재 사용하는 플랫폼입니다. 비활성화해도 기존 실적은 유지됩니다."
          />

          <InfoCard
            title="전체 합계"
            description="신청·예약 등 대시보드 전체 KPI 합계에 포함할지 결정합니다."
          />

          <InfoCard
            title="채널 차트"
            description="플랫폼별 비교 차트와 채널 분석 영역에 표시할지 결정합니다."
          />

        </section>

      </div>
    </main>
  );
}

/*
=========================================
SUMMARY CARD
=========================================
*/

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

      <div className="text-sm font-bold text-zinc-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black text-zinc-950">
        {value}
      </div>

    </div>
  );
}

/*
=========================================
TOGGLE
=========================================
*/

function ToggleButton({
  active,
  disabled,
  activeText,
  inactiveText,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  activeText: string;
  inactiveText: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-w-[90px] rounded-xl px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed ${
        active
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300"
      }`}
    >
      {active
        ? `● ${activeText}`
        : `○ ${inactiveText}`}
    </button>
  );
}

/*
=========================================
INFO CARD
=========================================
*/

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">

      <div className="font-black text-zinc-900">
        {title}
      </div>

      <p className="mt-2 text-sm leading-6 text-zinc-500">
        {description}
      </p>

    </div>
  );
}