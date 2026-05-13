import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관 - Jigeum",
  description: "Jigeum 베타 이용약관입니다.",
};

const updatedAt = "2026년 5월 4일";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-stone-300">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[#f5f0e8]">
            <img src="/brand/mark.svg?v=flow-5" alt="" className="h-9 w-9" />
          </div>
          <span className="text-lg font-bold tracking-tight">Jigeum</span>
        </Link>
        <div className="flex items-center gap-5 text-sm text-stone-400">
          <Link href="/privacy" className="transition hover:text-white">
            개인정보
          </Link>
          <Link href="/login" className="transition hover:text-white">
            로그인
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-200">
          TERMS OF SERVICE
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Jigeum 베타 이용약관
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-stone-400">
          최종 업데이트: {updatedAt}. 이 약관은 Jigeum 베타에 적용됩니다. Jigeum을 사용하면 본
          약관과 개인정보 처리방침에 동의한 것으로 봅니다.
        </p>

        <div className="mt-12 space-y-10">
          <Section title="베타 제품">
            <p>
              Jigeum은 현재 베타 제품입니다. 기능은 변경되거나 일시적으로 실패하거나 사용량 제한을
              받거나 제거될 수 있습니다. Jigeum은 요약, 분류, 리마인더, 회의 준비, 제안 작업에서
              실수할 수 있습니다.
            </p>
          </Section>

          <Section title="사용자의 책임">
            <ul className="list-disc space-y-2 pl-5">
              <li>Jigeum에 연결하는 계정과 데이터에 대한 책임은 사용자에게 있습니다.</li>
              <li>본인이 소유했거나 연결 권한이 있는 계정에만 Jigeum을 사용하세요.</li>
              <li>중요한 결과물은 사용하거나 신뢰하기 전에 직접 검토하세요.</li>
              <li>
                법률, 계약, 개인정보 권리, 플랫폼 규칙을 위반하는 방식으로 Jigeum을 사용하지 마세요.
              </li>
            </ul>
          </Section>

          <Section title="승인과 자동화">
            <p>
              Jigeum은 리마인더, 브리핑, 분류, 알림, 승인 제안을 만들 수 있습니다. 이메일 전송을
              포함한 민감한 작업은 실행 전에 사용자의 검토와 승인이 필요합니다. 사용자가 승인한
              작업에 대한 책임은 사용자에게 있습니다.
            </p>
          </Section>

          <Section title="Google 서비스">
            <p>
              Gmail 또는 Google Calendar를 연결하면 Jigeum 기능 제공에 필요한 Google 데이터 접근을
              허용하는 것입니다. Google 계정 설정에서 언제든지 Jigeum의 Google 접근 권한을 철회할 수
              있습니다.
            </p>
          </Section>

          <Section title="전문 조언 아님">
            <p>
              Jigeum은 업무 정리, 문안 초안 작성, 결정 우선순위 판단을 도울 수 있습니다. Jigeum은
              법률, 금융, 의료, 고용 또는 기타 전문 조언을 제공하지 않습니다. 중요한 정보는 실행 전
              직접 확인하세요.
            </p>
          </Section>

          <Section title="가용성과 데이터 손실">
            <p>
              Jigeum을 안정적으로 유지하기 위해 노력하지만 베타는 가동 시간 보장 없이 제공됩니다.
              베타 한계, 제3자 장애, 사용자 설정으로 인한 알림 누락, 동기화 지연, 부정확한 결과,
              데이터 손실에 대해서는 책임지지 않습니다.
            </p>
          </Section>

          <Section title="계정 삭제">
            <p>
              Jigeum 계정 데이터 삭제를 요청하려면{" "}
              <a className="text-amber-200 hover:text-amber-100" href="mailto:k0820086@gmail.com">
                k0820086@gmail.com
              </a>
              으로 연락해 주세요. Jigeum 계정 데이터를 삭제해도 Google 또는 다른 제3자 서비스의
              데이터가 자동으로 삭제되지는 않습니다.
            </p>
          </Section>

          <Section title="변경">
            <p>
              Jigeum이 변경됨에 따라 이 약관도 업데이트될 수 있습니다. 업데이트 후 Jigeum을 계속
              사용하면 변경된 약관에 동의한 것으로 봅니다.
            </p>
          </Section>

          <Section title="문의">
            <p>
              약관 관련 질문은{" "}
              <a className="text-amber-200 hover:text-amber-100" href="mailto:k0820086@gmail.com">
                k0820086@gmail.com
              </a>
              으로 연락해 주세요.
            </p>
          </Section>
        </div>
      </article>
    </main>
  );
}
