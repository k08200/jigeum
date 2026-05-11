"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AuthGuard from "../../components/auth-guard";
import { CardSkeleton } from "../../components/skeleton";
import { useToast } from "../../components/toast";
import { apiFetch } from "../../lib/api";

interface BillingStatus {
  plan: string;
  planName: string;
  messageLimit: number;
  messageCount: number;
  tokenLimit: number;
  tokenUsage: number;
  estimatedCost: number;
  stripeId: string | null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PLANS = [
  {
    key: "FREE",
    name: "무료",
    price: "$0",
    period: "",
    limit: "월 50 메시지 · 50만 토큰",
    features: ["메일/캘린더 읽기", "작업과 메모 관리", "무료 OpenRouter 모델"],
  },
  {
    key: "PRO",
    name: "Pro",
    price: "$29",
    period: "/mo",
    limit: "월 2천 메시지 · 1천만 토큰",
    features: [
      "무료 플랜의 모든 기능",
      "메일 발송과 캘린더 생성",
      "결정 루프 모드(Suggest + Policy Run)",
      "일일 브리핑과 메일 자동 분류",
      "메일 자동 답장과 패턴 학습",
      "Slack/Notion 연동",
      "웹 검색과 문서 작성",
      "GPT-5.4 및 Claude Sonnet 선택 모델",
    ],
  },
  {
    key: "ENTERPRISE",
    name: "엔터프라이즈",
    price: "문의",
    period: "",
    limit: "무제한",
    features: [
      "Pro 플랜의 모든 기능",
      "Claude Opus 선택 모델",
      "온프레미스 옵션",
      "SLA 보장",
      "맞춤 연동",
    ],
  },
];

export default function BillingPage() {
  return (
    <AuthGuard>
      <Suspense>
        <BillingContent />
      </Suspense>
    </AuthGuard>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    apiFetch<BillingStatus>("/api/billing/status")
      .then(setStatus)
      .catch(() => toast("결제 정보를 불러오지 못했습니다.", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  /** Only allow Stripe-hosted URLs to prevent open redirect */
  function safeRedirect(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.endsWith(".stripe.com")) {
        window.location.href = url;
      } else {
        toast("잘못된 이동 주소입니다.", "error");
      }
    } catch {
      toast("잘못된 이동 주소입니다.", "error");
    }
  }

  async function handleUpgrade(plan: "PRO") {
    try {
      const { url } = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (url) safeRedirect(url);
    } catch {
      toast("결제 세션을 만들지 못했습니다.", "error");
    }
  }

  async function handleManage() {
    try {
      const { url } = await apiFetch<{ url: string }>("/api/billing/portal", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (url) safeRedirect(url);
    } catch {
      toast("결제 포털을 열지 못했습니다.", "error");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:py-10">
      <header className="mb-6 rounded-2xl border border-stone-700/45 bg-stone-950/35 p-5 shadow-sm shadow-black/20">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
          플랜 기록
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-50 md:text-3xl">
          EVE 운영 한도와 실행 권한
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">
          결정 턴, 모델 사용량, 실행 모드를 한곳에서 확인하고 팀의 결정 흐름에 맞는 플랜으로
          조정합니다.
        </p>
      </header>

      {success && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          구독이 활성화되었습니다.
        </div>
      )}
      {canceled && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          결제가 취소되었습니다.
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {["s1", "s2", "s3"].map((sk) => (
            <CardSkeleton key={sk} />
          ))}
        </div>
      )}

      {!loading && status && (
        <div className="mb-8 rounded-2xl border border-stone-700/45 bg-stone-950/40 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                현재 플랜
              </p>
              <p className="mt-1 text-xl font-semibold text-stone-50">{status.planName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {status.estimatedCost > 0 && (
                <span className="rounded-full border border-stone-700 bg-stone-900/70 px-3 py-1 text-xs text-stone-400">
                  이번 달 약 ${status.estimatedCost.toFixed(4)}
                </span>
              )}
              {status.stripeId && (
                <button
                  type="button"
                  onClick={handleManage}
                  className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-400/15"
                >
                  구독 관리
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Decision turns usage */}
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-stone-400">결정 턴</span>
                <span className="text-stone-300">
                  {status.messageCount} /{" "}
                  {status.messageLimit === Infinity ? "∞" : status.messageLimit.toLocaleString()}
                </span>
              </div>
              {status.messageLimit !== Infinity && status.messageLimit > 0 && (
                <div className="h-2 w-full rounded-full bg-stone-800">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      status.messageCount / status.messageLimit > 0.9
                        ? "bg-red-500"
                        : status.messageCount / status.messageLimit > 0.7
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                    }`}
                    style={{
                      width: `${Math.min((status.messageCount / status.messageLimit) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Tokens usage */}
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-stone-400">토큰</span>
                <span className="text-stone-300">
                  {formatTokens(status.tokenUsage)} /{" "}
                  {status.tokenLimit === Infinity ? "∞" : formatTokens(status.tokenLimit)}
                </span>
              </div>
              {status.tokenLimit !== Infinity && status.tokenLimit > 0 && (
                <div className="h-2 w-full rounded-full bg-stone-800">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      status.tokenUsage / status.tokenLimit > 0.9
                        ? "bg-red-500"
                        : status.tokenUsage / status.tokenLimit > 0.7
                          ? "bg-amber-400"
                          : "bg-teal-400"
                    }`}
                    style={{
                      width: `${Math.min((status.tokenUsage / status.tokenLimit) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = status?.plan === plan.key;
          return (
            <div
              key={plan.key}
              className={`flex flex-col rounded-2xl border bg-stone-950/35 p-6 ${
                isCurrent
                  ? "border-amber-300/70"
                  : plan.key === "PRO"
                    ? "border-amber-400/45 ring-1 ring-amber-400/15"
                    : "border-stone-700/45"
              }`}
            >
              {plan.key === "PRO" && (
                <span className="mb-2 self-start rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-950">
                  추천
                </span>
              )}
              <p className="mb-1 text-lg font-semibold text-stone-50">{plan.name}</p>
              <p className="mb-1 text-2xl font-semibold text-stone-50">
                {plan.price}
                <span className="text-sm font-normal text-stone-500">{plan.period}</span>
              </p>
              <p className="mb-4 text-sm text-stone-400">{plan.limit}</p>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-stone-300">
                    <span className="mt-0.5 text-emerald-300">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 py-2 text-center text-sm font-medium text-amber-100">
                  현재 플랜
                </div>
              ) : plan.key === "FREE" ? (
                <div />
              ) : plan.key === "ENTERPRISE" ? (
                <a
                  href="mailto:sales@hireeve.com"
                  className="block rounded-lg border border-stone-700 bg-stone-900/70 py-2.5 text-center text-sm font-medium text-stone-100 transition hover:border-stone-500"
                >
                  세일즈 문의
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUpgrade(plan.key as "PRO")}
                  className="rounded-lg bg-amber-300 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-200"
                >
                  {plan.name}로 업그레이드
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
