export type OperatingPlanMode =
  | "clear_decisions"
  | "recover_risk"
  | "prepare_day"
  | "maintain_flow";

export type OperatingPlanTone = "critical" | "warn" | "steady";

export interface OperatingPlanMetric {
  label: string;
  value: number;
  tone: OperatingPlanTone;
}

export interface OperatingPlanMove {
  id: string;
  title: string;
  reason: string;
  href: string | null;
  prompt: string;
  label: string;
  tone: OperatingPlanTone;
  source: "attention" | "work_context" | "playbook";
}

export interface OperatingPlanWatchContext {
  id: string;
  title: string;
  href: string | null;
  risk: "high" | "medium" | "low";
  reason: string;
}

export interface OperatingPlanPlaybookNudge {
  id: string;
  name: string;
  active: boolean;
  confidence: number;
  nextStep: string | null;
}

export type OperatingPlanOutcomeStatus = "executed" | "rejected" | "failed";

export interface OperatingPlanOutcome {
  id: string;
  title: string;
  status: OperatingPlanOutcomeStatus;
  toolName: string;
  href: string;
  decidedAt: string;
  result: string | null;
}

export interface OperatingPlanDecisionPulse {
  windowHours: number;
  executed: number;
  rejected: number;
  failed: number;
  latest: OperatingPlanOutcome[];
}

export interface OperatingPlan {
  generatedAt: string;
  mode: OperatingPlanMode;
  headline: string;
  primaryAction: string;
  metrics: OperatingPlanMetric[];
  nextMoves: OperatingPlanMove[];
  watchlist: OperatingPlanWatchContext[];
  playbookNudge: OperatingPlanPlaybookNudge | null;
  decisionPulse: OperatingPlanDecisionPulse;
}
