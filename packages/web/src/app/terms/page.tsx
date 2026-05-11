import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Jigeum",
  description: "Beta terms for using Jigeum.",
};

const updatedAt = "May 4, 2026";

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
    <main className="min-h-screen bg-[#10100d] text-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-300 text-sm font-bold text-stone-950">J</div>
          <span className="text-lg font-bold tracking-tight">Jigeum</span>
        </Link>
        <div className="flex items-center gap-5 text-sm text-stone-400">
          <Link href="/privacy" className="transition hover:text-white">
            Privacy
          </Link>
          <Link href="/login" className="transition hover:text-white">
            Sign in
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-200">
          Terms of Service
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Beta terms for Jigeum
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-stone-400">
          Last updated: {updatedAt}. These terms apply to the Jigeum beta. By using Jigeum, you agree to
          these terms and the Privacy Policy.
        </p>

        <div className="mt-12 space-y-10">
          <Section title="Beta product">
            <p>
              Jigeum is currently a beta product. Features may change, break, be rate-limited, or be
              removed. Jigeum may make mistakes, including incorrect summaries, classifications,
              reminders, meeting preparation, or suggested actions.
            </p>
          </Section>

          <Section title="Your responsibilities">
            <ul className="list-disc space-y-2 pl-5">
              <li>You are responsible for the accounts and data you connect to Jigeum.</li>
              <li>You must use Jigeum only with accounts you own or are authorized to connect.</li>
              <li>You must review important outputs before relying on them.</li>
              <li>
                You must not use Jigeum to violate laws, contracts, privacy rights, or platform rules.
              </li>
            </ul>
          </Section>

          <Section title="Approvals and automation">
            <p>
              Jigeum may create reminders, briefings, classifications, notifications, and approval
              proposals. Sensitive actions, including sending email, should be reviewed and approved
              by you before execution. You remain responsible for actions you approve.
            </p>
          </Section>

          <Section title="Google services">
            <p>
              If you connect Gmail or Google Calendar, you authorize Jigeum to access the Google data
              needed to provide Jigeum features. You can revoke Jigeum&apos;s Google access from your
              Google account settings at any time.
            </p>
          </Section>

          <Section title="No professional advice">
            <p>
              Jigeum may help organize work, draft text, and identify priorities. Jigeum does not provide
              legal, financial, medical, employment, or other professional advice. Verify important
              information before acting.
            </p>
          </Section>

          <Section title="Availability and data loss">
            <p>
              We try to keep Jigeum reliable, but the beta is provided without uptime guarantees. We
              are not responsible for missed notifications, delayed sync, inaccurate outputs, or
              data loss caused by beta limitations, third-party outages, or user configuration.
            </p>
          </Section>

          <Section title="Account deletion">
            <p>
              You may request deletion of your Jigeum account data by contacting{" "}
              <a className="text-amber-200 hover:text-amber-100" href="mailto:k0820086@gmail.com">
                k0820086@gmail.com
              </a>
              . Deleting Jigeum account data does not automatically delete data from Google or other
              third-party services.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update these terms as Jigeum changes. Continued use of Jigeum after updates means you
              accept the updated terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms can be sent to{" "}
              <a className="text-amber-200 hover:text-amber-100" href="mailto:k0820086@gmail.com">
                k0820086@gmail.com
              </a>
              .
            </p>
          </Section>
        </div>
      </article>
    </main>
  );
}
