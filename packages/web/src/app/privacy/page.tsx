import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보 처리방침 - Jigeum",
  description: "Jigeum 베타에서 Gmail, Calendar, 계정 데이터를 다루는 방식입니다.",
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

export default function PrivacyPage() {
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
          <Link href="/terms" className="transition hover:text-white">
            이용약관
          </Link>
          <Link href="/login" className="transition hover:text-white">
            로그인
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-200">
          PRIVACY POLICY
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Jigeum이 업무 데이터를 다루는 방식
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-stone-400">
          최종 업데이트: {updatedAt}. Jigeum은 현재 베타 제품입니다. 이 문서는 Jigeum이 어떤
          데이터에 접근하는지, 왜 접근하는지, 삭제를 어떻게 요청할 수 있는지 설명합니다.
        </p>

        <div className="mt-12 space-y-10">
          <Section title="Jigeum이 하는 일">
            <p>
              Jigeum은 Gmail, 캘린더, 작업, 리마인더, 알림, 관련 업무 맥락을 검토해 중요한 답장,
              회의, 후속 조치를 더 쉽게 판단하도록 돕는 업무 결정 OS입니다.
            </p>
          </Section>

          <Section title="수집하는 데이터">
            <p>Jigeum을 사용할 때 다음 데이터를 수집하거나 저장할 수 있습니다.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>이메일 주소와 이름 같은 계정 정보.</li>
              <li>
                Gmail과 캘린더를 연결하고 백그라운드 동기화를 실행하는 데 필요한 Google OAuth 토큰.
              </li>
              <li>
                발신자, 수신자, 제목, 스니펫, 본문, 라벨, 읽음 상태, 스레드 ID, AI 요약, 답장 필요
                신호 같은 Gmail 메타데이터와 콘텐츠.
              </li>
              <li>제목, 시간, 참석자, 장소, 설명 같은 캘린더 이벤트 정보.</li>
              <li>
                작업, 리마인더, 메모, 약속, 승인한 작업, 피드백, 알림, 채팅 메시지 등 Jigeum 안에서
                만든 제품 데이터.
              </li>
              <li>베타 운영과 개선에 필요한 사용량, 토큰, 오류, 전달 로그.</li>
            </ul>
          </Section>

          <Section title="데이터 사용 방식">
            <p>Jigeum은 제품 제공과 개선을 위해서만 데이터를 사용합니다. 예시는 다음과 같습니다.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Google을 연결한 뒤 Gmail과 캘린더를 동기화합니다.</li>
              <li>아침 브리핑을 만들고 확인이 필요한 메일이나 회의를 찾습니다.</li>
              <li>승인 제안, 리마인더, 작업, 알림을 만듭니다.</li>
              <li>베타 기간 동안 Jigeum의 제안이 유용한지 측정합니다.</li>
              <li>안정성 문제를 디버깅하고 악용을 방지하며 서비스를 보호합니다.</li>
            </ul>
          </Section>

          <Section title="Google 사용자 데이터">
            <p>
              Jigeum은 업무 맥락을 읽고, 중요한 메시지를 찾고, 캘린더 맥락을 관리하고, 사용자의
              승인을 받을 작업을 준비하기 위해 Gmail과 캘린더 권한을 요청합니다.
            </p>
            <p>
              Jigeum은 Google 사용자 데이터를 판매하거나 광고에 사용하거나 무관한 제3자에게 이전하지
              않습니다. Google 사용자 데이터는 사용자가 보는 Jigeum 기능을 제공하거나 개선하는 데만
              사용됩니다.
            </p>
            <p>
              이메일 전송은 민감한 작업으로 취급합니다. 베타 기간 동안 Jigeum은 사용자 몰래 답장을
              보내지 않습니다. 이메일 작업은 전송 전에 사용자의 승인이 필요합니다.
            </p>
          </Section>

          <Section title="AI 처리">
            <p>
              Jigeum은 요약, 분류, 초안 작성, 우선순위 판단을 위해 이메일 스니펫, 본문, 캘린더 세부
              정보, 작업, 메모 같은 관련 업무 맥락을 AI 모델 제공자에게 보낼 수 있습니다. 사용 중인
              기능에 필요한 맥락만 보냅니다.
            </p>
          </Section>

          <Section title="보관과 삭제">
            <p>
              계정이 활성 상태이거나 베타 운영에 필요한 동안 계정 및 워크스페이스 데이터를
              보관합니다. 언제든지 내보내기 또는 삭제를 요청할 수 있습니다.
            </p>
            <p>
              계정 데이터 삭제를 요청하려면{" "}
              <a className="text-amber-200 hover:text-amber-100" href="mailto:k0820086@gmail.com">
                k0820086@gmail.com
              </a>
              으로 연락해 주세요. 인증된 사용자는 Jigeum 안의 데이터 삭제 기능도 사용할 수 있습니다.
              Jigeum 데이터를 삭제해도 사용자가 Jigeum 안에서 명시적으로 승인하지 않는 한 Google
              계정의 메시지나 이벤트는 삭제되지 않습니다.
            </p>
          </Section>

          <Section title="보안">
            <p>
              Jigeum은 접근 제어, 인증, 운영상 보호 장치를 사용해 사용자 데이터를 보호합니다.
              Jigeum은 베타 제품이므로 베타 서비스에 연결하기 부담스러운 정보가 포함된 계정은
              연결하지 않는 것을 권장합니다.
            </p>
          </Section>

          <Section title="문의">
            <p>
              질문, 삭제 요청, 보안 관련 문의는{" "}
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
