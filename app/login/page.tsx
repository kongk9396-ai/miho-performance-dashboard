"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  LockKeyhole,
  Loader2,
} from "lucide-react";

export default function LoginPage() {
  const [
    username,
    setUsername,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  async function login(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                username,
                password,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        setError(
          result.message ??
            "로그인에 실패했습니다."
        );

        return;
      }

      window.location.href =
        "/admin";
    } catch {
      setError(
        "로그인 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <LockKeyhole
              size={22}
            />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-zinc-900">
            관리자 로그인
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            MIHO Performance Dashboard
          </p>
        </div>

        <form
          onSubmit={login}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-bold text-zinc-700">
            아이디
          </label>

          <input
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value
              )
            }
            autoComplete="username"
            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-blue-500"
            placeholder="관리자 아이디"
          />

          <label className="mt-5 block text-sm font-bold text-zinc-700">
            비밀번호
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-blue-500"
            placeholder="비밀번호"
          />

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && (
              <Loader2
                size={17}
                className="animate-spin"
              />
            )}

            로그인
          </button>
        </form>
      </div>
    </main>
  );
}