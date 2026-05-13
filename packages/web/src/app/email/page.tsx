"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import AuthGuard from "../../components/auth-guard";
import { apiFetch } from "../../lib/api";
import { captureClientError } from "../../lib/sentry";

type Filter =
  | "all"
  | "reply-needed"
  | "urgent"
  | "unread"
  | "candidates"
  | "attachments"
  | "finance"
  | "legal"
  | "sales"
  | "support"
  | "threads"
  | "automated";

interface CandidateProfilePreview {
  name: string | null;
  role: string | null;
  contact: string | null;
  summary: string;
  missingFields: string[];
  confidence: number;
  evidenceCount: number;
  intakeStatus: string | null;
}

interface EmailRow {
  id: string;
  gmailId: string;
  from: string;
  subject: string;
  snippet: string | null;
  date: string;
  isRead: boolean;
  priority: "URGENT" | "NORMAL" | "LOW";
  category: string | null;
  summary: string | null;
  needsReply?: boolean;
  attachmentCount?: number;
  attachmentCandidateCount?: number;
  attachmentPendingCount?: number;
  attachmentFallbackCount?: number;
  attachmentUnsupportedCount?: number;
  attachmentCategories?: string[];
  candidateProfilePreview?: CandidateProfilePreview | null;
}

interface ThreadRow {
  threadId: string;
  subject: string;
  participants: string[];
  messageCount: number;
  hasUnread: boolean;
  latestPriority: "URGENT" | "NORMAL" | "LOW";
  summary: string | null;
  lastMessage: {
    id: string;
    from: string;
    snippet: string | null;
    receivedAt: string;
    isRead: boolean;
  };
}

interface ListResponse {
  emails: EmailRow[];
  source: "gmail" | "demo";
  total: number;
  unread: number;
}

interface ThreadListResponse {
  threads: ThreadRow[];
  source: "gmail" | "demo";
  total: number;
}

type BulkAction = "mark-read" | "mark-unread" | "archive" | "set-priority";

interface BulkActionResponse {
  success: boolean;
  updatedCount: number;
  failed?: Array<{ id: string; error: string }>;
}

const FILTERS: { key: Filter; label: string; query: string }[] = [
  { key: "all", label: "전체 신호", query: "" },
  { key: "reply-needed", label: "답장 필요", query: "filter=reply-needed" },
  { key: "urgent", label: "긴급", query: "filter=urgent" },
  { key: "unread", label: "읽지 않음", query: "filter=unread" },
  { key: "attachments", label: "첨부", query: "filter=attachments" },
  { key: "candidates", label: "후보자", query: "filter=candidates" },
  { key: "finance", label: "재무", query: "category=billing" },
  { key: "legal", label: "법무", query: "search=contract" },
  { key: "sales", label: "세일즈", query: "category=business" },
  { key: "support", label: "지원", query: "search=support" },
  { key: "threads", label: "스레드", query: "" },
  { key: "automated", label: "자동화", query: "category=automated" },
];

const WORK_QUEUES: Array<{
  key: Filter;
  title: string;
  description: string;
  count: (emails: EmailRow[]) => number;
}> = [
  {
    key: "finance",
    title: "재무 문서",
    description: "청구, 송장, 결제 실패, 계약 금액",
    count: (emails) =>
      emails.filter((email) =>
        `${email.category ?? ""} ${email.subject} ${email.summary ?? ""} ${email.snippet ?? ""}`
          .toLowerCase()
          .match(/billing|invoice|payment|receipt|청구|송장|결제|영수증/),
      ).length,
  },
  {
    key: "legal",
    title: "법무 검토",
    description: "계약, 규제, 서명, 리스크",
    count: (emails) =>
      emails.filter((email) =>
        `${email.subject} ${email.summary ?? ""} ${email.snippet ?? ""}`.match(
          /계약|서명|법무|규제|contract|legal|signature|compliance/i,
        ),
      ).length,
  },
  {
    key: "sales",
    title: "매출/고객",
    description: "고객 답장, 갱신, 가격, 미팅 후속",
    count: (emails) =>
      emails.filter((email) =>
        `${email.category ?? ""} ${email.subject} ${email.summary ?? ""}`.match(
          /business|customer|sales|renewal|pricing|고객|가격|갱신|제안/i,
        ),
      ).length,
  },
  {
    key: "support",
    title: "지원/이슈",
    description: "버그, 장애, 불만, 에스컬레이션",
    count: (emails) =>
      emails.filter((email) =>
        `${email.subject} ${email.summary ?? ""} ${email.snippet ?? ""}`.match(
          /bug|issue|error|support|blocked|장애|오류|문의|불만|지원/i,
        ),
      ).length,
  },
];

export default function EmailPage() {
  return (
    <AuthGuard>
      <EmailView />
    </AuthGuard>
  );
}

function EmailView() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [source, setSource] = useState<"gmail" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async (f: Filter, keyword = "") => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const q = FILTERS.find((x) => x.key === f)?.query || "";
      const params = new URLSearchParams(q);
      if (keyword.trim()) params.set("search", keyword.trim());
      if (f === "threads") {
        const data = await apiFetch<ThreadListResponse>(
          `/api/email/threads${params.toString() ? `?${params.toString()}` : ""}`,
        );
        setThreads(data.threads);
        setEmails([]);
        setSource(data.source);
      } else {
        const data = await apiFetch<ListResponse>(
          `/api/email${params.toString() ? `?${params.toString()}` : ""}`,
        );
        setEmails(data.emails);
        setThreads([]);
        setSource(data.source);
      }
    } catch (err) {
      captureClientError(err, { scope: "email.load", filter: f });
      setError("메일을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter, appliedSearch);
  }, [appliedSearch, filter, load]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
  };

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      await apiFetch("/api/email/sync", { method: "POST", body: JSON.stringify({}) });
      await load(filter, appliedSearch);
    } catch (err) {
      captureClientError(err, { scope: "email.sync" });
      setError("Gmail 동기화에 실패했어요.");
    } finally {
      setSyncing(false);
    }
  };

  const reanalyzeAttachments = async () => {
    setReanalyzing(true);
    setError(null);
    try {
      await apiFetch("/api/email/attachments/analyze", {
        method: "POST",
        body: JSON.stringify({ retryFallback: true, limit: 50 }),
      });
      await load(filter, appliedSearch);
    } catch (err) {
      captureClientError(err, { scope: "email.attachments.analyzeAll" });
      setError("첨부파일 분석을 다시 실행하지 못했어요.");
    } finally {
      setReanalyzing(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleIds = emails.map((email) => email.id);
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((emailId) => selectedIds.has(emailId));

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return new Set();
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  };

  const applyBulkAction = async (
    action: BulkAction,
    options: { priority?: EmailRow["priority"] } = {},
  ) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkBusy(true);
    setError(null);
    try {
      const data = await apiFetch<BulkActionResponse>("/api/email/bulk", {
        method: "POST",
        body: JSON.stringify({ ids, action, priority: options.priority }),
      });
      setEmails((prev) => updateEmailsAfterBulk(prev, ids, action, options.priority));
      setSelectedIds(new Set());
      if (data.failed && data.failed.length > 0) {
        setError(`${data.failed.length}개 메일은 처리하지 못했어요. 다시 시도해 주세요.`);
      }
    } catch (err) {
      captureClientError(err, { scope: "email.bulk", action });
      setError("선택한 메일을 처리하지 못했어요.");
    } finally {
      setBulkBusy(false);
    }
  };

  const unreadCount = emails.filter((email) => !email.isRead).length;
  const urgentCount = emails.filter((email) => email.priority === "URGENT").length;
  const replyCount = emails.filter((email) => email.needsReply).length;
  const candidateCount = emails.filter((email) => (email.attachmentCandidateCount ?? 0) > 0).length;
  const attachmentCount = emails.filter((email) => (email.attachmentCount ?? 0) > 0).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:py-10">
      <header className="mb-5 rounded-lg border border-white/10 bg-[#11161A] p-5 shadow-xl shadow-black/10 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FF8A70]">
              메일
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-50">
              답해야 할 메일만 먼저 보기
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">
              긴급도와 답장 필요 여부를 기준으로 정리합니다.
              {source === "demo" && <span className="ml-2 text-[#FF6B4A]">데모 데이터</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="h-9 w-fit rounded-md border border-white/10 bg-[#090B10] px-3 text-xs font-medium text-stone-300 transition hover:border-white/20 hover:bg-white/5 hover:text-stone-100 disabled:opacity-50"
          >
            {syncing ? "동기화 중..." : "지금 동기화"}
          </button>
          <button
            type="button"
            onClick={reanalyzeAttachments}
            disabled={reanalyzing}
            className="h-9 w-fit rounded-md border border-[#7DD3FC]/25 bg-[#7DD3FC]/10 px-3 text-xs font-medium text-sky-100 transition hover:bg-[#7DD3FC]/15 disabled:opacity-50"
          >
            {reanalyzing ? "첨부 분석 중..." : "첨부 다시 분석"}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-md border border-white/10 bg-[#090B10]">
          <SignalStat label="읽지 않음" value={unreadCount} />
          <SignalStat label="긴급" value={urgentCount} />
          <SignalStat label="답장" value={replyCount} />
          <SignalStat label="첨부" value={attachmentCount} />
        </div>
      </header>

      <form onSubmit={submitSearch} className="mb-3 flex gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="발신자, 본문, 첨부 텍스트, 추출 필드 검색"
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#090B10] px-3 text-sm text-stone-200 outline-none transition placeholder:text-stone-600 focus:border-[#FF6B4A]/45"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-[#FF6B4A] px-4 text-sm font-medium text-stone-950 transition hover:bg-[#FFB09C]"
        >
          검색
        </button>
        {appliedSearch && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setAppliedSearch("");
            }}
            className="h-10 rounded-lg border border-white/10 bg-[#11161A] px-3 text-xs text-stone-400 transition hover:bg-white/5"
          >
            초기화
          </button>
        )}
      </form>

      <FilterTabs current={filter} onChange={setFilter} />

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {WORK_QUEUES.map((queue) => (
          <button
            key={queue.key}
            type="button"
            onClick={() => setFilter(queue.key)}
            className={`rounded-lg border p-3 text-left transition ${
              filter === queue.key
                ? "border-[#FF6B4A]/45 bg-[#FF6B4A]/10"
                : "border-white/10 bg-[#11161A] hover:border-white/20 hover:bg-white/5"
            }`}
          >
            <span className="block text-sm font-medium text-stone-100">{queue.title}</span>
            <span className="mt-1 block text-[11px] leading-4 text-stone-500">
              {queue.description}
            </span>
            <span className="mt-2 block text-xs text-[#FF8A70]">
              현재 화면 신호 {queue.count(emails)}
            </span>
          </button>
        ))}
      </div>

      {candidateCount > 0 && (
        <Link
          href="/email/candidates"
          className="mt-3 flex items-center justify-between rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-sm text-[#FFB09C] transition hover:bg-orange-500/10"
        >
          <span>후보자 접수 큐에서 {candidateCount}개 후보 신호를 검토할 수 있어요.</span>
          <span className="text-xs">열기</span>
        </Link>
      )}

      {loading && <p className="px-1 py-3 text-sm text-stone-500">로딩 중...</p>}

      {error && (
        <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && filter !== "threads" && emails.length === 0 && (
        <div className="mt-4 rounded-lg border border-white/10 bg-[#11161A] p-6 text-center">
          <p className="text-sm text-stone-300">
            {filter === "all" ? "아직 들어온 메일 신호가 없어요." : "조건에 맞는 신호가 없어요."}
          </p>
          <p className="mt-1 text-xs text-stone-600">
            동기화가 끝나면 실행이 필요한 메일만 먼저 떠오릅니다.
          </p>
        </div>
      )}

      {!loading && filter !== "threads" && emails.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          <li>
            <BulkActionBar
              allVisibleSelected={allVisibleSelected}
              busy={bulkBusy}
              selectedCount={selectedCount}
              totalVisible={emails.length}
              onApply={applyBulkAction}
              onClear={() => setSelectedIds(new Set())}
              onToggleAll={toggleAllVisible}
            />
          </li>
          {emails.map((e) => (
            <EmailRowItem
              key={e.id}
              email={e}
              queue={filter}
              selected={selectedIds.has(e.id)}
              onToggleSelected={toggleSelected}
            />
          ))}
        </ul>
      )}

      {!loading && filter === "threads" && threads.length === 0 && !error && (
        <div className="mt-4 rounded-lg border border-white/10 bg-[#11161A] p-6 text-center">
          <p className="text-sm text-stone-300">조건에 맞는 스레드가 없어요.</p>
        </div>
      )}

      {!loading && filter === "threads" && threads.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {threads.map((thread) => (
            <ThreadRowItem key={thread.threadId} thread={thread} />
          ))}
        </ul>
      )}
    </div>
  );
}

function updateEmailsAfterBulk(
  emails: EmailRow[],
  ids: string[],
  action: BulkAction,
  priority?: EmailRow["priority"],
): EmailRow[] {
  const selected = new Set(ids);
  if (action === "archive") return emails.filter((email) => !selected.has(email.id));
  if (action === "mark-read" || action === "mark-unread") {
    const isRead = action === "mark-read";
    return emails.map((email) => (selected.has(email.id) ? { ...email, isRead } : email));
  }
  if (action === "set-priority" && priority) {
    return emails.map((email) => (selected.has(email.id) ? { ...email, priority } : email));
  }
  return emails;
}

function BulkActionBar({
  allVisibleSelected,
  busy,
  selectedCount,
  totalVisible,
  onApply,
  onClear,
  onToggleAll,
}: {
  allVisibleSelected: boolean;
  busy: boolean;
  selectedCount: number;
  totalVisible: number;
  onApply: (action: BulkAction, options?: { priority?: EmailRow["priority"] }) => void;
  onClear: () => void;
  onToggleAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[#0C1116] px-3 py-2 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleAll}
          className="h-8 rounded-md border border-white/10 bg-[#11161A] px-2.5 text-xs font-medium text-stone-300 transition hover:bg-white/5"
        >
          {allVisibleSelected ? "전체 해제" : "현재 화면 선택"}
        </button>
        <span className="text-xs text-stone-500">
          {selectedCount > 0 ? `${selectedCount}개 선택됨` : `현재 화면 ${totalVisible}개`}
        </span>
      </div>
      {selectedCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <BulkButton disabled={busy} onClick={() => onApply("mark-read")}>
            읽음
          </BulkButton>
          <BulkButton disabled={busy} onClick={() => onApply("mark-unread")}>
            안읽음
          </BulkButton>
          <BulkButton
            disabled={busy}
            onClick={() => onApply("set-priority", { priority: "URGENT" })}
          >
            긴급
          </BulkButton>
          <BulkButton disabled={busy} onClick={() => onApply("set-priority", { priority: "LOW" })}>
            낮음
          </BulkButton>
          <BulkButton disabled={busy} danger onClick={() => onApply("archive")}>
            보관
          </BulkButton>
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="h-8 rounded-md px-2.5 text-xs text-stone-500 transition hover:bg-white/5 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}

function BulkButton({
  children,
  danger = false,
  disabled,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 rounded-md border px-2.5 text-xs font-medium transition disabled:opacity-50 ${
        danger
          ? "border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/15"
          : "border-white/10 bg-[#11161A] text-stone-300 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function SignalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-stone-800 px-4 py-3 last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-stone-100">{value}</p>
    </div>
  );
}

function FilterTabs({ current, onChange }: { current: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
      {FILTERS.map((f) => {
        const active = f.key === current;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={`min-h-[32px] shrink-0 rounded-full px-3 py-1.5 text-xs transition ${
              active
                ? "bg-[#FF6B4A] text-[#190B07]"
                : "border border-white/10 bg-[#11161A] text-stone-400 hover:bg-white/6 hover:text-stone-200"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

function EmailRowItem({
  email,
  queue,
  selected,
  onToggleSelected,
}: {
  email: EmailRow;
  queue: Filter;
  selected: boolean;
  onToggleSelected: (id: string) => void;
}) {
  const unread = !email.isRead;
  const detailParams = new URLSearchParams({ markRead: "false", queue });
  return (
    <li className="grid grid-cols-[auto_1fr] gap-2">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${email.subject || "제목 없음"} 선택`}
        onClick={() => onToggleSelected(email.id)}
        className={`mt-4 h-5 w-5 rounded border transition ${
          selected
            ? "border-[#FF6B4A] bg-[#FF6B4A] shadow-[inset_0_0_0_4px_#0C1116]"
            : "border-white/15 bg-[#11161A] hover:border-white/30"
        }`}
      />
      <Link
        href={`/email/${email.id}?${detailParams.toString()}`}
        className="block rounded-lg border border-white/10 bg-[#11161A] transition hover:border-white/20 hover:bg-white/5 active:bg-white/10"
      >
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-start">
          <div className="min-w-0 flex-1">
            <EmailBadges email={email} unread={unread} />
            <p
              className={`mt-2 truncate text-sm ${unread ? "font-semibold text-stone-100" : "text-stone-300"}`}
            >
              {senderName(email.from)}
            </p>
            <p className="mt-1 truncate text-[13px] text-stone-400">
              {email.subject || "제목 없음"}
            </p>
            {email.summary ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-400">
                <span className="mr-1 text-stone-500">요약:</span>
                {email.summary}
              </p>
            ) : email.snippet ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-600">{email.snippet}</p>
            ) : null}
            {email.candidateProfilePreview && (
              <CandidatePreview profile={email.candidateProfilePreview} />
            )}
          </div>
          <time className="shrink-0 text-[11px] tabular-nums text-stone-500 md:pt-1">
            {formatRelative(email.date)}
          </time>
        </div>
      </Link>
    </li>
  );
}

function EmailBadges({ email, unread }: { email: EmailRow; unread: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <PriorityBadge priority={email.priority} />
      {email.needsReply && <ReplyNeededBadge />}
      {(email.attachmentCandidateCount ?? 0) > 0 && <CandidateBadge />}
      {(email.attachmentCount ?? 0) > 0 && (
        <span className="shrink-0 rounded border border-[#7DD3FC]/30 bg-[#7DD3FC]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#7DD3FC]">
          첨부 {email.attachmentCount}
        </span>
      )}
      {(email.attachmentPendingCount ?? 0) > 0 && (
        <span className="shrink-0 rounded border border-stone-600 bg-stone-900/70 px-1.5 py-0.5 text-[10px] font-medium text-stone-400">
          분석 대기 {email.attachmentPendingCount}
        </span>
      )}
      {(email.attachmentFallbackCount ?? 0) > 0 && (
        <span className="shrink-0 rounded border border-[#FF6B4A]/25 bg-[#FF6B4A]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#FF6B4A]">
          기본 분석 {email.attachmentFallbackCount}
        </span>
      )}
      {email.category && <CategoryBadge category={email.category} />}
      {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6B4A]" />}
    </div>
  );
}

function ThreadRowItem({ thread }: { thread: ThreadRow }) {
  return (
    <li>
      <Link
        href={`/email/${thread.lastMessage.id}?markRead=false`}
        className="block rounded-lg border border-white/10 bg-[#11161A] transition hover:border-white/20 hover:bg-white/5 active:bg-white/10"
      >
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={thread.latestPriority} />
              {thread.hasUnread && (
                <span className="rounded border border-[#FF6B4A]/30 bg-[#FF6B4A]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#FF6B4A]">
                  읽지 않음
                </span>
              )}
              <span className="rounded border border-stone-700 bg-stone-900/60 px-1.5 py-0.5 text-[10px] text-stone-400">
                {thread.messageCount}개 메일
              </span>
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-stone-100">
              {thread.subject || "제목 없음"}
            </p>
            <p className="mt-1 truncate text-[12px] text-stone-500">
              {thread.participants.map(senderName).join(", ")}
            </p>
            {thread.summary ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-400">{thread.summary}</p>
            ) : thread.lastMessage.snippet ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-600">
                {thread.lastMessage.snippet}
              </p>
            ) : null}
          </div>
          <time className="shrink-0 text-[11px] tabular-nums text-stone-500 md:pt-1">
            {formatRelative(thread.lastMessage.receivedAt)}
          </time>
        </div>
      </Link>
    </li>
  );
}

function CandidatePreview({ profile }: { profile: CandidateProfilePreview }) {
  const title = [profile.name || "이름 미확인", profile.role].filter(Boolean).join(" · ");
  const missing =
    profile.missingFields.length > 0
      ? `추가 확인: ${profile.missingFields.map(candidateMissingLabel).join(", ")}`
      : null;
  return (
    <div className="mt-2 rounded-lg border border-orange-500/15 bg-orange-500/5 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium text-[#FFB09C]">{title}</p>
        <span className="shrink-0 text-[10px] tabular-nums text-[#FF8A70]/80">
          {Math.round(profile.confidence * 100)}%
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-stone-400">{profile.summary}</p>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-stone-500">
        {profile.contact && <span className="truncate">연락처 {profile.contact}</span>}
        {profile.intakeStatus && <span>{candidateIntakeLabel(profile.intakeStatus)}</span>}
        <span>파일 {profile.evidenceCount}개</span>
        {missing && <span className="text-[#FF6B4A]/80">{missing}</span>}
      </div>
    </div>
  );
}

function candidateIntakeLabel(status: string): string {
  const labels: Record<string, string> = {
    NEEDS_ANALYSIS: "분석 필요",
    NEEDS_INFO: "정보 확인",
    READY_TO_REVIEW: "검토 대기",
    REVIEWING: "검토 중",
    CONTACTED: "연락 완료",
    SHORTLISTED: "보류/후보",
    REJECTED: "거절",
    ARCHIVED: "보관",
  };
  return labels[status] || status;
}

function candidateMissingLabel(field: string): string {
  const labels: Record<string, string> = {
    name: "이름",
    contact: "연락처",
    role: "역할",
    portfolio: "포트폴리오",
  };
  return labels[field] || field;
}
function ReplyNeededBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#FF6B4A]/30 bg-[#FF6B4A]/10 text-[#FF6B4A] font-medium shrink-0">
      답장 필요
    </span>
  );
}

function CandidateBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#FF6B4A]/30 bg-[#FF6B4A]/10 text-[#FF8A70] font-medium shrink-0">
      후보자
    </span>
  );
}

function PriorityBadge({ priority }: { priority: EmailRow["priority"] }) {
  const styles = {
    URGENT: "bg-red-500/15 text-red-300 border-red-500/30",
    NORMAL: "bg-stone-800 text-stone-400 border-stone-700",
    LOW: "bg-stone-900 text-stone-500 border-stone-800",
  } as const;
  const labels = { URGENT: "긴급", NORMAL: "일반", LOW: "낮음" } as const;
  if (priority === "NORMAL") return null;
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border ${styles[priority]} font-medium shrink-0`}
    >
      {labels[priority]}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const labelMap: Record<string, string> = {
    business: "비즈니스",
    engineering: "엔지니어링",
    automated: "자동화",
    newsletter: "뉴스레터",
    meeting: "미팅",
    billing: "청구",
    conversation: "대화",
    other: "기타",
  };
  const label = labelMap[category] || category;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border border-stone-700 bg-stone-900/60 text-stone-400 shrink-0">
      {label}
    </span>
  );
}

function senderName(raw: string): string {
  const match = raw.match(/^([^<]+?)\s*</);
  if (match?.[1]) return match[1].trim();
  return raw.replace(/[<>]/g, "").trim();
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}
