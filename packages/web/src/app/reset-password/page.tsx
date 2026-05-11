"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthScreen from "../../components/auth-screen";
import { useToast } from "../../components/toast";
import { apiFetch } from "../../lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Without a token, show the reset-link request form.
  if (!token) {
    return <ForgotPasswordForm />;
  }

  return <NewPasswordForm token={token} />;
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      toast("재설정 링크를 보내지 못했습니다.", "error");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <AuthScreen
        eyebrow="Password reset"
        title="메일을 확인하세요"
        description="해당 이메일 계정이 있다면 비밀번호 재설정 링크를 보냈습니다."
        footer={
          <Link href="/login" className="transition hover:text-stone-300">
            로그인으로 돌아가기
          </Link>
        }
      >
        <div className="border-y border-stone-800/80 py-5 text-sm leading-6 text-stone-300">
          링크는 보안을 위해 제한된 시간 동안만 사용할 수 있습니다. 메일이 보이지 않으면 스팸함도
          확인해 주세요.
        </div>
        <Link
          href="/login"
          className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-stone-950 transition hover:bg-amber-200"
        >
          로그인 화면 열기
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      eyebrow="Password reset"
      title="비밀번호 재설정"
      description="계정 이메일을 입력하면 안전한 재설정 링크를 보내드립니다."
      footer={
        <Link href="/login" className="transition hover:text-stone-300">
          로그인으로 돌아가기
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-stone-400">
            이메일
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-md border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300/25"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !email}
          className="flex h-11 w-full items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500"
        >
          {loading ? "전송 중..." : "재설정 링크 보내기"}
        </button>
      </form>
    </AuthScreen>
  );
}

function NewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast("비밀번호가 일치하지 않습니다.", "error");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "재설정에 실패했습니다.", "error");
    }
    setLoading(false);
  };

  if (done) {
    return (
      <AuthScreen
        eyebrow="Password updated"
        title="비밀번호 재설정 완료"
        description="비밀번호가 정상적으로 변경되었습니다. 이제 새 비밀번호로 로그인할 수 있습니다."
      >
        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-stone-950 transition hover:bg-amber-200"
        >
          로그인
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      eyebrow="New password"
      title="새 비밀번호 설정"
      description="다음 로그인부터 사용할 새 비밀번호를 입력하세요."
      footer={
        <Link href="/login" className="transition hover:text-stone-300">
          로그인으로 돌아가기
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-stone-400">
            새 비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
            required
            minLength={6}
            className="w-full rounded-md border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300/25"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-xs font-medium text-stone-400">
            비밀번호 확인
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="비밀번호 다시 입력"
            required
            minLength={6}
            className="w-full rounded-md border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300/25"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className="flex h-11 w-full items-center justify-center rounded-md bg-amber-300 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500"
        >
          {loading ? "재설정 중..." : "비밀번호 재설정"}
        </button>
      </form>
    </AuthScreen>
  );
}
