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

export interface OperatingPlan {
  generatedAt: string;
  mode: OperatingPlanMode;
  headline: string;
  primaryAction: string;
  metrics: OperatingPlanMetric[];
  nextMoves: OperatingPlanMove[];
  watchlist: OperatingPlanWatchContext[];
  playbookNudge: OperatingPlanPlaybookNudge | null;
}
