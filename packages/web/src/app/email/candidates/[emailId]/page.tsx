"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AuthGuard from "../../../../components/auth-guard";
import { apiFetch } from "../../../../lib/api";
import { captureClientError } from "../../../../lib/sentry";

type CandidateStatus =
  | "NEEDS_ANALYSIS"
  | "NEEDS_INFO"
  | "READY_TO_REVIEW"
  | "REVIEWING"
  | "CONTACTED"
  | "SHORTLISTED"
  | "REJECTED"
  | "ARCHIVED";

interface CandidateProfile {
  pipelineStatus: "ready_to_review" | "needs_info" | "needs_analysis";
  nextAction: string;
  name: string | null;
  role: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  age: string | null;
  height: string | null;
  skills: string[];
  links: string[];
  summary: string;
  evidenceFiles: Array<{
    filename: string;
    category: string | null;
    summary: string | null;
    analysisStatus: string;
    needsManualReview: boolean;
    reviewReason: string | null;
  }>;
  manualReviewFiles: Array<{ filename: string; status: string; reason: string }>;
  missingFields: string[];
  confidence: number;
}

interface CandidateIntake {
  id: string;
  status: CandidateStatus;
  notes: string | null;
  updatedAt: string;
}

interface EmailDetail {
  id: string;
  from: string;
  subject: string;
  date: string;
  summary: string | null;
  candidateProfile: CandidateProfile | null;
  candidateIntake: CandidateIntake | null;
}

const STATUSES: Array<{ value: CandidateStatus; label: string }> = [
  { value: "NEEDS_ANALYSIS", label: "분석 필요" },
  { value: "NEEDS_INFO", label: "정보 확인" },
  { value: "READY_TO_REVIEW", label: "검토 대기" },
  { value: "REVIEWING", label: "검토 중" },
  { value: "CONTACTED", label: "연락 완료" },
  { value: "SHORTLISTED", label: "보류/후보" },
  { value: "REJECTED", label: "거절" },
  { value: "ARCHIVED", label: "보관" },
];

export default function CandidateDetailPage() {
  return (
    <AuthGuard>
      <CandidateDetailView />
    </AuthGuard>
  );
}

function CandidateDetailView() {
  const params = useParams<{ emailId: string }>();
  const emailId = params?.emailId;
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!emailId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<EmailDetail>(`/api/email/${emailId}`);
      setEmail(data);
      setNotes(data.candidateIntake?.notes ?? "");
    } catch (err) {
      captureClientError(err, { scope: "email.candidate-detail.load", emailId });
      setError("후보자 정보를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [emailId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (patch: { status?: CandidateStatus; notes?: string | null }) => {
    if (!emailId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<{ candidateIntake: CandidateIntake }>(
        `/api/email/${emailId}/candidate-intake`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      setEmail((prev) => (prev ? { ...prev, candidateIntake: data.candidateIntake } : prev));
    } catch (err) {
      captureClientError(err, { scope: "email.candidate-detail.update", emailId });
      setError("후보자 상태를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const profile = email?.candidateProfile ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:py-10">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/email/candidates"
          className="rounded-lg border border-stone-700/60 px-3 py-1.5 text-xs text-stone-300 hover:border-[#FF6B4A]/35 hover:text-[#FFE2D7]"
        >
          후보 큐
        </Link>
        {email && (
          <Link
            href={`/email/${email.id}`}
            className="rounded-lg border border-stone-700/60 px-3 py-1.5 text-xs text-stone-300 hover:border-[#FF6B4A]/35 hover:text-[#FFE2D7]"
          >
            원본 메일
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-stone-500">로딩 중...</p>}
      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {email && profile && (
        <main className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FF8A70]/80">
                  Candidate CRM
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-stone-50">
                  {[profile.name || "이름 미확인", profile.role].filter(Boolean).join(" · ")}
                </h1>
                <p className="mt-2 text-sm leading-6 text-stone-400">{profile.summary}</p>
              </div>
              <span className="rounded border border-[#FF8A70]/25 bg-[#FF8A70]/10 px-2 py-1 text-xs text-[#FFB09C]">
                {Math.round(profile.confidence * 100)}%
              </span>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Fact label="연락처" value={profile.contact} />
              <Fact label="나이/생년" value={profile.age} />
              <Fact label="신장" value={profile.height} />
              <Fact label="상태" value={pipelineLabel(profile.pipelineStatus)} />
            </div>

            {profile.skills.length > 0 && <ChipBlock title="특기/언어" values={profile.skills} />}
            {profile.links.length > 0 && <ChipBlock title="링크" values={profile.links} />}

            {(profile.missingFields.length > 0 || profile.manualReviewFiles.length > 0) && (
              <div className="mt-5 rounded-lg border border-[#FF6B4A]/20 bg-[#FF6B4A]/10 p-3">
                <p className="text-xs font-medium text-[#FFE2D7]">{profile.nextAction}</p>
                {profile.manualReviewFiles.map((file) => (
                  <p key={file.filename} className="mt-1 text-[11px] text-[#FFB09C]/80">
                    {file.filename}: {file.reason}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-5 space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                증거 파일
              </h2>
              {profile.evidenceFiles.map((file) => (
                <div
                  key={file.filename}
                  className="rounded-lg border border-stone-800/70 bg-black/15 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-stone-200">{file.filename}</span>
                    <span className="text-[10px] text-stone-600">
                      {file.category || "document"} · {file.analysisStatus}
                    </span>
                    {file.needsManualReview && (
                      <span className="text-[10px] text-rose-300">원본 확인</span>
                    )}
                  </div>
                  {file.summary && (
                    <p className="mt-1 text-[11px] leading-5 text-stone-500">{file.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-xl border border-stone-700/45 bg-stone-950/35 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-300">
              검토 상태
            </h2>
            <div className="mt-3 grid gap-2">
              {STATUSES.map((status) => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => update({ status: status.value, notes })}
                  disabled={saving}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition disabled:opacity-50 ${
                    email.candidateIntake?.status === status.value
                      ? "border-[#FF8A70]/45 bg-[#FF8A70]/10 text-[#FFE2D7]"
                      : "border-stone-700/55 text-stone-400 hover:border-[#FF6B4A]/30 hover:text-[#FFE2D7]"
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-stone-600">
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-stone-700/60 bg-black/20 px-3 py-2 text-xs leading-5 text-stone-300 outline-none focus:border-[#FF6B4A]/40"
              />
            </label>
            <button
              type="button"
              onClick={() => update({ notes })}
              disabled={saving}
              className="mt-2 w-full rounded-lg bg-[#FF8A70] px-3 py-2 text-xs font-medium text-stone-950 transition hover:bg-[#FFB09C] disabled:opacity-50"
            >
              {saving ? "저장 중..." : "메모 저장"}
            </button>
            <div className="mt-4 rounded-lg border border-stone-800/70 bg-black/15 px-3 py-2">
              <p className="text-xs text-stone-300">{email.subject || "제목 없음"}</p>
              <p className="mt-1 text-[11px] text-stone-600">{email.from}</p>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-stone-800/70 bg-black/15 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-stone-600">{label}</p>
      <p className="mt-1 truncate text-sm text-stone-200">{value || "-"}</p>
    </div>
  );
}

function ChipBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="mt-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full border border-stone-700/60 bg-black/15 px-2 py-1 text-xs text-stone-300"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function pipelineLabel(status: CandidateProfile["pipelineStatus"]): string {
  if (status === "needs_analysis") return "분석 필요";
  if (status === "needs_info") return "정보 확인";
  return "검토 가능";
}
