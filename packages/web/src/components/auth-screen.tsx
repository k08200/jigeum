"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface AuthScreenProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  asideTitle?: string;
  asideBody?: string;
  asideItems?: Array<{ label: string; value: string }>;
  footer?: ReactNode;
  navCtaHref?: string;
  navCtaLabel?: string;
}

export default function AuthScreen({
  eyebrow,
  title,
  description,
  children,
  asideTitle = "결정 가능한 업무 신호만 남깁니다",
  asideBody = "EVE는 메일, 캘린더, 작업의 흐름을 읽고 실행 전 확인할 수 있는 승인 카드로 정리합니다.",
  asideItems = [
    { label: "신호", value: "메일과 일정의 변경점 감지" },
    { label: "맥락", value: "사람, 마감, 프로젝트 연결" },
    { label: "승인", value: "외부 실행 전 근거 확인" },
  ],
  footer,
  navCtaHref = "/early-access",
  navCtaLabel = "얼리 액세스",
}: AuthScreenProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#10100d] text-stone-50">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(115deg,rgba(216,164,93,0.13)_0%,transparent_34%,rgba(20,184,166,0.09)_72%,transparent_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:54px_54px]" />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <img src="/brand/mark.svg" alt="" className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-[0.18em] text-stone-100">EVE</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link className="text-stone-400 transition hover:text-stone-100" href="/">
            홈
          </Link>
          <Link
            className="rounded-md border border-stone-700/70 px-3 py-2 text-stone-300 transition hover:border-amber-300/40 hover:text-amber-100"
            href={navCtaHref}
          >
            {navCtaLabel}
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100svh-76px)] max-w-6xl items-center gap-8 px-5 pb-16 pt-6 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
        <aside className="hidden lg:block">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300">
              Decision OS
            </p>
            <h2 className="mt-4 text-5xl font-semibold leading-[0.98] tracking-tight text-white">
              {asideTitle}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-stone-400">{asideBody}</p>
          </div>
          <div className="mt-9 max-w-xl border-y border-white/10 bg-black/15">
            {asideItems.map((item, index) => (
              <div
                key={item.label}
                className="grid grid-cols-[72px_1fr] gap-4 border-b border-white/10 px-4 py-4 last:border-b-0"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-600">
                    0{index + 1}
                  </p>
                  <p className="mt-1 text-sm font-medium text-amber-100">{item.label}</p>
                </div>
                <p className="text-sm leading-6 text-stone-300">{item.value}</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-stone-400">{description}</p>
          </div>

          <div className="rounded-lg border border-stone-700/55 bg-stone-950/72 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            {children}
          </div>

          {footer && <div className="mt-5 text-center text-xs text-stone-500">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
