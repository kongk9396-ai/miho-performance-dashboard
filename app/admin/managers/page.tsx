"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Manager = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ManagersResponse = {
  ok: boolean;
  message?: string;
  managers?: Manager[];
  manager?: Manager;
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

export default function ManagersPage() {
  const [managers, setManagers] =
    useState<Manager[]>([]);

  const [newName, setNewName] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [adding, setAdding] =
    useState(false);

  const [savingId, setSavingId] =
    useState<number | null>(null);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  /*
  =========================================
  요약
  =========================================
  */

  const activeCount =
    useMemo(
      () =>
        managers.filter(
          (manager) =>
            manager.isActive
        ).length,
      [managers]
    );

  const inactiveCount =
    managers.length -
    activeCount;

  /*
  =========================================
  목록 불러오기
  =========================================
  */

  const loadManagers =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/admin/managers",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const result =
          (await response.json()) as ManagersResponse;

        if (
          !response.ok ||
          !result.ok
        ) {
          throw new Error(
            result.message ??
              "실장 목록을 불러오지 못했습니다."
          );
        }

        setManagers(
          result.managers ?? []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "실장 목록을 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadManagers();
  }, [loadManagers]);

  /*
  =========================================
  새 실장 추가
  =========================================
  */

  async function addManager() {
    const name =
      newName.trim();

    if (!name) {
      setError(
        "추가할 실장 이름을 입력해주세요."
      );

      return;
    }

    setAdding(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/managers",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name,
            }),
          }
        );

      const result =
        (await response.json()) as ManagersResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "실장 추가에 실패했습니다."
        );
      }

      setNewName("");

      setMessage(
        result.message ??
          `${name} 실장을 추가했습니다.`
      );

      await loadManagers();

      setMessage(
        result.message ??
          `${name} 실장을 추가했습니다.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "실장 추가에 실패했습니다."
      );
    } finally {
      setAdding(false);
    }
  }

  /*
  =========================================
  화면에서 값 변경
  =========================================
  */

  function updateLocal(
    id: number,
    field:
      | "name"
      | "sortOrder",
    value: string
  ) {
    setManagers(
      (current) =>
        current.map(
          (manager) =>
            manager.id === id
              ? {
                  ...manager,

                  [field]:
                    field ===
                    "sortOrder"
                      ? safeNumber(
                          value
                        )
                      : value,
                }
              : manager
        )
    );

    setMessage("");
  }

  /*
  =========================================
  이름/순서 저장
  =========================================
  */

  async function saveManager(
    manager: Manager
  ) {
    const name =
      manager.name.trim();

    if (!name) {
      setError(
        "실장 이름은 비워둘 수 없습니다."
      );

      return;
    }

    setSavingId(
      manager.id
    );

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/managers",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id: manager.id,

              name,

              sortOrder:
                manager.sortOrder,
            }),
          }
        );

      const result =
        (await response.json()) as ManagersResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "실장 정보 저장에 실패했습니다."
        );
      }

      setMessage(
        `${name} 실장 정보를 저장했습니다.`
      );

      await loadManagers();

      setMessage(
        `${name} 실장 정보를 저장했습니다.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "실장 정보 저장에 실패했습니다."
      );
    } finally {
      setSavingId(null);
    }
  }

  /*
  =========================================
  활성 / 비활성
  =========================================
  */

  async function toggleActive(
    manager: Manager
  ) {
    const nextActive =
      !manager.isActive;

    const action =
      nextActive
        ? "활성화"
        : "비활성화";

    if (
      !window.confirm(
        `${manager.name} 실장을 ${action}할까요?\n\n비활성화해도 기존 실적 데이터는 삭제되지 않습니다.`
      )
    ) {
      return;
    }

    setSavingId(
      manager.id
    );

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/managers",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id: manager.id,

              isActive:
                nextActive,
            }),
          }
        );

      const result =
        (await response.json()) as ManagersResponse;

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            `실장 ${action}에 실패했습니다.`
        );
      }

      setMessage(
        `${manager.name} 실장을 ${action}했습니다.`
      );

      await loadManagers();

      setMessage(
        `${manager.name} 실장을 ${action}했습니다.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `실장 ${action}에 실패했습니다.`
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
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
            실장 관리
          </h1>

          <p className="mt-2 text-zinc-500">
            실장을 추가하거나 이름,
            정렬순서, 활성 상태를
            관리합니다.
          </p>
        </div>

        {/* SUMMARY */}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-zinc-500">
              전체 실장
            </div>

            <div className="mt-2 text-3xl font-black text-zinc-950">
              {managers.length}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-zinc-500">
              활성
            </div>

            <div className="mt-2 text-3xl font-black text-emerald-600">
              {activeCount}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-zinc-500">
              비활성
            </div>

            <div className="mt-2 text-3xl font-black text-zinc-400">
              {inactiveCount}
            </div>
          </div>
        </section>

        {/* 새 실장 */}

        <section className="mb-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black text-zinc-950">
              새 실장 추가
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              추가하면 실적 관리에서
              바로 사용할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
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
                  void addManager();
                }
              }}
              placeholder="실장 이름"
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-bold outline-none transition focus:border-blue-500 focus:bg-white"
            />

            <button
              type="button"
              onClick={
                addManager
              }
              disabled={
                adding ||
                !newName.trim()
              }
              className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {adding
                ? "추가 중..."
                : "실장 추가"}
            </button>
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-bold text-red-700">
            {error}
          </div>
        )}

        {/* MESSAGE */}

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-bold text-emerald-700">
            {message}
          </div>
        )}

        {/* LIST */}

        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-5">
            <h2 className="text-xl font-black text-zinc-950">
              등록된 실장
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              비활성화해도 과거 실적은
              유지됩니다.
            </p>
          </div>

          {loading ? (
            <div className="p-16 text-center font-bold text-zinc-400">
              실장 목록을 불러오는 중...
            </div>
          ) : managers.length ===
            0 ? (
            <div className="p-16 text-center">
              <div className="font-black text-zinc-700">
                아직 등록된 실장이 없습니다.
              </div>

              <div className="mt-2 text-sm text-zinc-400">
                위에서 첫 실장을
                추가해주세요.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {managers.map(
                (manager) => (
                  <div
                    key={
                      manager.id
                    }
                    className={`grid gap-4 px-6 py-5 lg:grid-cols-[minmax(200px,1fr)_140px_140px_120px] lg:items-center ${
                      manager.isActive
                        ? ""
                        : "bg-zinc-50 opacity-70"
                    }`}
                  >
                    {/* 이름 */}

                    <div>
                      <div className="mb-1 text-xs font-bold text-zinc-400">
                        실장명
                      </div>

                      <input
                        type="text"
                        value={
                          manager.name
                        }
                        onChange={(
                          event
                        ) =>
                          updateLocal(
                            manager.id,
                            "name",
                            event
                              .target
                              .value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 font-black text-zinc-900 outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* 순서 */}

                    <div>
                      <div className="mb-1 text-xs font-bold text-zinc-400">
                        정렬순서
                      </div>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          manager.sortOrder
                        }
                        onChange={(
                          event
                        ) =>
                          updateLocal(
                            manager.id,
                            "sortOrder",
                            event
                              .target
                              .value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-right font-bold outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* 상태 */}

                    <div>
                      <div className="mb-1 text-xs font-bold text-zinc-400">
                        상태
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          toggleActive(
                            manager
                          )
                        }
                        disabled={
                          savingId ===
                          manager.id
                        }
                        className={`w-full rounded-xl px-4 py-2.5 text-sm font-black transition ${
                          manager.isActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                        }`}
                      >
                        {manager.isActive
                          ? "● 활성"
                          : "○ 비활성"}
                      </button>
                    </div>

                    {/* 저장 */}

                    <div className="lg:self-end">
                      <button
                        type="button"
                        onClick={() =>
                          saveManager(
                            manager
                          )
                        }
                        disabled={
                          savingId ===
                          manager.id
                        }
                        className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-black disabled:bg-zinc-400"
                      >
                        {savingId ===
                        manager.id
                          ? "처리 중..."
                          : "저장"}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}