"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AuthGuard from "../../../components/auth-guard";
import { apiFetch } from "../../../lib/api";
import { captureClientError } from "../../../lib/sentry";

type TrustBadge = "reliable" | "mostly_reliable" | "unreliable" | "unknown";
type CommitmentStatus = "OPEN" | "DONE" | "DISMISSED" | "SNOOZED";
type CommitmentOwner = "USER" | "COUNTERPARTY" | "TEAM" | "UNKNOWN";

interface TrustScore {
  badge: TrustBadge;
  label: string;
  totalCount: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number;
  avgDelayDays: number;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
  tags: string | null;
}

interface Commitment {
  id: string;
  title: string;
  status: CommitmentStatus;
  owner: CommitmentOwner;
  dueAt: string | null;
  dueText: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface DetailResponse {
  contact: Contact;
  trust: TrustScore | null;
  commitments: Commitment[];
}

const BADGE_META: Record<TrustBadge, { label: string; color: string; dot: string }> = {
  reliable: {
    label: "Reliable",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    dot: "bg-emerald-400",
  },
  mostly_reliable: {
    label: "Mostly reliable",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    dot: "bg-amber-400",
  },
  unreliable: {
    label: "Unreliable",
    color: "text-red-400 bg-red-400/10 border-red-400/20",
    dot: "bg-red-400",
  },
  unknown: {
    label: "Unknown",
    color: "text-stone-500 bg-stone-800/40 border-stone-700",
    dot: "bg-stone-600",
  },
};

const STATUS_LABEL: Record<CommitmentStatus, string> = {
  OPEN: "Open",
  DONE: "Done",
  DISMISSED: "Dismissed",
  SNOOZED: "Snoozed",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function isOverdue(c: Commitment): boolean {
  return c.status === "OPEN" && c.dueAt !== null && new Date(c.dueAt) < new Date();
}

function formatDue(dueAt: string | null, dueText: string | null): string | null {
  if (dueText) return dueText;
  if (!dueAt) return null;
  const d = new Date(dueAt);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CommitmentItem({ commitment }: { commitment: Commitment }) {
  const due = formatDue(commitment.dueAt, commitment.dueText);
  const overdue = isOverdue(commitment);
  const done = commitment.status === "DONE";
  const ownerLabel =
    commitment.owner === "USER" ? "I owe" : commitment.owner === "COUNTERPARTY" ? "They owe" : "—";

  return (
    <article className="rounded-lg border border-stone-800 bg-stone-900/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
            done
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
              : overdue
                ? "border-red-500/20 bg-red-500/10 text-red-300"
                : "border-stone-700 bg-stone-800/40 text-stone-400"
          }`}
        >
          {STATUS_LABEL[commitment.status]}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-stone-600">{ownerLabel}</span>
        {due && (
          <span className={`text-[11px] ${overdue ? "text-red-400" : "text-stone-500"}`}>
            {due}
          </span>
        )}
      </div>
      <p
        className={`mt-1 break-words text-[13px] ${
          done ? "text-stone-600 line-through" : "text-stone-200"
        }`}
      >
        {commitment.title}
      </p>
    </article>
  );
}

function ContactDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    apiFetch<DetailResponse>(`/api/contacts/${id}`)
      .then(setData)
      .catch((err) => {
        captureClientError(err, { scope: "contact-detail.load" });
        setError("Contact not found.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/api/contacts/${id}`, { method: "DELETE" });
      router.push("/contacts");
    } catch (err) {
      captureClientError(err, { scope: "contact-detail.delete" });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="h-32 animate-pulse rounded-xl border border-stone-800 bg-stone-900/30" />
        <div className="mt-4 h-40 animate-pulse rounded-xl border border-stone-800 bg-stone-900/30" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-sm text-stone-400">{error ?? "Contact not found."}</p>
        <Link
          href="/contacts"
          className="mt-3 inline-block text-[12px] text-amber-300 hover:underline"
        >
          ← Back to contacts
        </Link>
      </div>
    );
  }

  const { contact, trust, commitments } = data;
  const badge = trust?.badge ?? "unknown";
  const meta = BADGE_META[badge];

  const openCommitments = commitments.filter((c) => c.status === "OPEN" || c.status === "SNOOZED");
  const closedCommitments = commitments.filter(
    (c) => c.status === "DONE" || c.status === "DISMISSED",
  );
  const onTimePct = trust ? Math.round(trust.onTimeRate * 100) : 0;

  return (
    <div className="min-h-dvh bg-[#0f1115]">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <Link
          href="/contacts"
          className="mb-4 inline-flex items-center gap-1 text-[12px] text-stone-500 hover:text-stone-300"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Contacts
        </Link>

        {/* Header card */}
        <section className="rounded-2xl border border-stone-800 bg-stone-900/40 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-600 to-stone-800 text-base font-bold text-stone-200">
                {initials(contact.name)}
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-lg font-semibold text-stone-100">{contact.name}</h1>
                {(contact.role || contact.company) && (
                  <p className="mt-0.5 text-[13px] text-stone-500">
                    {[contact.role, contact.company].filter(Boolean).join(" · ")}
                  </p>
                )}
                {contact.email && (
                  <p className="mt-0.5 break-all text-[12px] text-stone-600">{contact.email}</p>
                )}
                {contact.phone && <p className="text-[12px] text-stone-600">{contact.phone}</p>}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${meta.color}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-md px-2 py-1 text-[11px] text-stone-500 hover:text-stone-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-md bg-red-600/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-600/30 transition disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-md p-1.5 text-stone-700 transition hover:text-red-400"
                  aria-label="Delete contact"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {contact.notes && (
            <p className="mt-4 whitespace-pre-wrap rounded-lg border border-stone-800 bg-black/20 p-3 text-[12px] leading-5 text-stone-400">
              {contact.notes}
            </p>
          )}
        </section>

        {/* Trust stats */}
        {trust && trust.totalCount > 0 && (
          <section className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3">
              <p className="text-2xl font-semibold tabular-nums text-stone-100">
                {trust.totalCount}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-stone-600">Total</p>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3">
              <p className="text-2xl font-semibold tabular-nums text-emerald-300">
                {trust.onTimeCount}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-stone-600">On time</p>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3">
              <p className="text-2xl font-semibold tabular-nums text-red-300">{trust.lateCount}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-stone-600">Late</p>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3">
              <p className="text-2xl font-semibold tabular-nums text-stone-100">{onTimePct}%</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-stone-600">
                On-time rate
              </p>
            </div>
          </section>
        )}

        {/* Commitments */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-widest text-stone-500">
              Commitments
            </h2>
            <span className="text-[11px] text-stone-700">{commitments.length}</span>
          </div>

          {commitments.length === 0 ? (
            <div className="rounded-xl border border-stone-800 bg-stone-900/20 py-8 text-center">
              <p className="text-sm text-stone-500">No commitments tracked yet.</p>
              <p className="mt-1 text-[12px] text-stone-700">
                EVE tracks promises automatically from your inbox.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {openCommitments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-stone-600">Open</p>
                  {openCommitments.map((c) => (
                    <CommitmentItem key={c.id} commitment={c} />
                  ))}
                </div>
              )}
              {closedCommitments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] text-stone-600">Resolved</p>
                  {closedCommitments.map((c) => (
                    <CommitmentItem key={c.id} commitment={c} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return null;
  return (
    <AuthGuard>
      <ContactDetail id={id} />
    </AuthGuard>
  );
}
