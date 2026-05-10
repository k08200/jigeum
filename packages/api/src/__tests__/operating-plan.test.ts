import { describe, expect, it } from "vitest";
import type { InboxSummary } from "../inbox-summary.js";
import { buildOperatingPlanFromSignals } from "../operating-plan.js";
import type { PlaybookRecommendation } from "../playbooks.js";
import type { WorkGraphSummary } from "../work-graph.js";

const NOW = new Date("2026-05-11T09:00:00.000Z").getTime();

const emptyInbox: InboxSummary = {
  top3: [],
  today: { events: [], overdueTasks: [], todayTasks: [] },
};

const emptyGraph: WorkGraphSummary = {
  generatedAt: new Date(NOW).toISOString(),
  contexts: [],
};

describe("buildOperatingPlanFromSignals", () => {
  it("prioritizes pending decisions as the operating mode", () => {
    const plan = buildOperatingPlanFromSignals({
      now: NOW,
      graph: emptyGraph,
      inbox: {
        ...emptyInbox,
        top3: [
          {
            kind: "pending_action",
            id: "pa-1",
            toolName: "send_email",
            label: "send email: PartnerCo",
            conversationId: "chat-1",
            reasoning: "투자자 답장을 보내기 전 승인 필요",
            decision: {
              priority: 100,
              confidence: 0.9,
              suggestedAction: "답장 초안을 확인하고 승인",
              costOfIgnoring: "투자자 후속 조치가 하루 더 밀립니다.",
              evidence: [{ label: "근거", value: "승인 대기" }],
            },
          },
        ],
      },
    });

    expect(plan.mode).toBe("clear_decisions");
    expect(plan.primaryAction).toBe("send email: PartnerCo");
    expect(plan.metrics.find((metric) => metric.label === "결정")).toMatchObject({
      value: 1,
      tone: "critical",
    });
    expect(plan.nextMoves[0]).toMatchObject({
      href: "/chat/chat-1",
      label: "승인 필요",
      reason: "답장 초안을 확인하고 승인",
    });
  });

  it("turns high-risk work graph contexts into recovery moves", () => {
    const plan = buildOperatingPlanFromSignals({
      now: NOW,
      inbox: emptyInbox,
      graph: {
        generatedAt: new Date(NOW).toISOString(),
        contexts: [
          {
            id: "email:thread-1",
            kind: "email_thread",
            title: "PartnerCo renewal",
            subtitle: "Minsu",
            href: "/email/email-1",
            people: [{ name: "Minsu", email: "minsu@example.com" }],
            lastActivityAt: new Date(NOW - 60_000).toISOString(),
            risk: "high",
            reasons: ["긴급 메일", "지난 약속"],
            signals: {
              emails: 1,
              unreadEmails: 1,
              urgentEmails: 1,
              pendingActions: 0,
              commitments: 1,
              overdueCommitments: 1,
            },
          },
        ],
      },
    });

    expect(plan.mode).toBe("recover_risk");
    expect(plan.nextMoves[0]).toMatchObject({
      title: "PartnerCo renewal",
      label: "위험 맥락",
      href: "/email/email-1",
    });
    expect(plan.watchlist[0]).toMatchObject({
      id: "email:thread-1",
      risk: "high",
      reason: "긴급 메일",
    });
  });

  it("adds a playbook nudge when a matching recommendation exists", () => {
    const recommendation: PlaybookRecommendation = {
      playbook: {
        id: "launch_room",
        domain: "launch",
        name: "Launch Room",
        description: "Coordinate launch work",
        bestFor: "launches",
        cadence: "Daily",
        targetSignals: ["launch"],
        activationChecklist: [],
        active: true,
      },
      score: 35,
      confidence: 0.7,
      reasons: ["High-risk matching context"],
      activeContexts: [],
      suggestedFirstActions: [
        {
          id: "launch-blockers",
          title: "Find launch blockers",
          description: "Surface approvals and overdue promises.",
        },
      ],
    };

    const plan = buildOperatingPlanFromSignals({
      now: NOW,
      inbox: emptyInbox,
      graph: emptyGraph,
      recommendations: [recommendation],
    });

    expect(plan.playbookNudge).toMatchObject({
      id: "launch_room",
      active: true,
      nextStep: "Find launch blockers",
    });
    expect(plan.nextMoves[0]).toMatchObject({
      source: "playbook",
      label: "활성 Playbook",
    });
  });
});
