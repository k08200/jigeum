"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AuthScreen from "../../components/auth-screen";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, token: authToken } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "pending">("loading");

  useEffect(() => {
    if (token) {
      // Redirected from email link; the API handles verification through GET redirect.
      setStatus("success");
    } else if (user) {
      setStatus("pending");
    } else {
      setStatus("error");
    }
  }, [token, user]);

  const resend = async () => {
    if (!authToken) return;
    try {
      await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#10100d]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
      </div>
    );
  }

  return (
    <AuthScreen
      eyebrow="이메일 인증"
      title={
        status === "success"
          ? "인증 메일을 보냈어요"
          : status === "pending"
            ? "이메일을 인증해 주세요"
            : "인증에 실패했어요"
      }
      description={
        status === "success"
          ? "받은 편지함에서 인증 링크를 열면 Jigeum 워크스페이스를 모두 사용할 수 있어요."
          : status === "pending"
            ? "계정 이메일을 인증하면 모든 워크스페이스 기능이 열립니다."
            : "링크가 만료되었거나 올바르지 않습니다. 다시 로그인한 뒤 새 인증 메일을 요청해 주세요."
      }
      footer={
        <Link href="/login" className="transition hover:text-stone-300">
          로그인으로 돌아가기
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-stone-700/60 bg-black/20 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            다음 단계
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-300">
            {status === "success"
              ? "Jigeum 인증 메일을 열고 링크를 따라가세요. 인증 후 결정 큐로 돌아올 수 있습니다."
              : status === "pending"
                ? "메일이 보이지 않으면 새 인증 링크를 다시 보내세요."
                : "로그인으로 돌아가 계정 상태를 확인한 뒤 새 인증 메일을 요청하세요."}
          </p>
        </div>

        {status === "success" ? (
          <Link
            href="/inbox"
            className="flex h-11 w-full items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-stone-950 transition hover:bg-amber-200"
          >
            결정 큐 열기
          </Link>
        ) : status === "pending" ? (
          <button
            type="button"
            onClick={resend}
            className="flex h-11 w-full items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-stone-950 transition hover:bg-amber-200"
          >
            인증 메일 다시 보내기
          </button>
        ) : (
          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center rounded-md border border-stone-700 bg-stone-900/70 text-sm font-semibold text-stone-100 transition hover:border-stone-500"
          >
            로그인으로 돌아가기
          </Link>
        )}
      </div>
    </AuthScreen>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
