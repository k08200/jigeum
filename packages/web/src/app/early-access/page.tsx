"use client";

import Link from "next/link";
import { useState } from "react";
import AuthScreen from "@/components/auth-screen";
import { API_BASE } from "@/lib/api";

type Status = "idle" | "submitting" | "success" | "already" | "error";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{1,63}$/;

export default function EarlyAccessPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setErrorMsg("이메일 형식이 올바르지 않아요.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          name: name.trim() || undefined,
          useCase: useCase.trim() || undefined,
        }),
      });

      if (res.status === 429) {
        setStatus("error");
        setErrorMsg("요청이 너무 잦아요. 잠시 후 다시 시도해주세요.");
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus("error");
        setErrorMsg(body.error || "문제가 생겼어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      const body = (await res.json()) as { ok: boolean; alreadyOnList?: boolean };
      setStatus(body.alreadyOnList ? "already" : "success");
    } catch (_err) {
      setStatus("error");
      setErrorMsg("네트워크 오류예요. 잠시 후 다시 시도해주세요.");
    }
  };

  const isDone = status === "success" || status === "already";

  return (
    <AuthScreen
      eyebrow="Early access"
      title="매일 흩어진 일을 결정 가능한 신호로 정리하세요"
      description="EVE는 비공개 베타입니다. 메일과 캘린더 사용량이 많은 팀부터 초대하고 있습니다."
      navCtaHref="/login"
      navCtaLabel="로그인"
      asideTitle="베타는 적은 팀으로 깊게 봅니다"
      asideBody="신청 내용을 바탕으로 메일, 일정, 후속 조치가 실제로 자주 엉키는 팀부터 온보딩합니다."
      asideItems={[
        { label: "신청", value: "메일과 업무 패턴을 간단히 남깁니다." },
        { label: "검토", value: "24시간 안에 베타 적합도를 확인합니다." },
        { label: "초대", value: "승인 후 로그인 가능한 계정 안내를 보냅니다." },
      ]}
      footer={
        <span>
          <Link href="/privacy" className="transition hover:text-stone-300">
            개인정보
          </Link>
          <span className="mx-2 text-stone-700">/</span>
          <Link href="/terms" className="transition hover:text-stone-300">
            약관
          </Link>
        </span>
      }
    >
      {isDone ? (
        <div>
          <div className="rounded-md border border-amber-300/25 bg-amber-300/10 p-4">
            <h2 className="text-base font-semibold text-white">
              {status === "already" ? "이미 신청해주셨어요" : "신청 완료"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              {status === "already"
                ? "기존 신청을 기준으로 검토 후 메일로 답변드릴게요."
                : "검토 후 24시간 안에 메일로 답변드릴게요. 메일이 도착하면 EVE에 로그인하실 수 있어요."}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link
              href="/"
              className="flex h-10 items-center justify-center rounded-md border border-stone-700 text-sm text-stone-300 transition hover:border-stone-500"
            >
              홈으로
            </Link>
            <Link
              href="/login"
              className="flex h-10 items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-stone-950 transition hover:bg-amber-200"
            >
              로그인
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-400" htmlFor="email">
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300/25"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-400" htmlFor="name">
              이름
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="w-full rounded-md border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300/25"
              placeholder="선택 입력"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-400" htmlFor="useCase">
              평소 메일을 어떻게 쓰세요?
            </label>
            <input
              id="useCase"
              type="text"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              maxLength={500}
              className="w-full rounded-md border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300/25"
              placeholder="예: 하루 메일 50통+, 일정과 후속 조치가 자주 엉킴"
            />
            <p className="mt-2 text-xs leading-5 text-stone-500">
              메일/캘린더 사용 패턴이 베타에 잘 맞을지 보는 용도예요.
            </p>
          </div>

          {errorMsg && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="flex h-11 w-full items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500"
          >
            {status === "submitting" ? "신청 중..." : "얼리 액세스 신청하기"}
          </button>

          <p className="text-xs leading-5 text-stone-500">
            신청 시{" "}
            <Link href="/privacy" className="underline hover:text-stone-300">
              개인정보 처리방침
            </Link>
            과{" "}
            <Link href="/terms" className="underline hover:text-stone-300">
              약관
            </Link>
            에 동의한 것으로 간주됩니다.
          </p>
        </form>
      )}
    </AuthScreen>
  );
}
