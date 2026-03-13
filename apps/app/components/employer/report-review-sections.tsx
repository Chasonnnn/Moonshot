"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { CodeIcon, FileTextIcon, LinkIcon, BrainIcon, ScaleIcon, ShieldCheckIcon } from "lucide-react"

import type { PracticeRetryActionState, ReportDetailSnapshot } from "@/actions/reports"
import { EventTimeline } from "@/components/employer/event-timeline"
import { IntegrityTierSelect } from "@/components/employer/integrity-tier-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { IntegrityTier } from "@/lib/integrity-tiers"
import { DEMO_CASE_TEMPLATES } from "@/lib/moonshot/demo-case-templates"
import { getRoundToolActions } from "@/lib/moonshot/demo-fixtures"
import type { SessionMode } from "@/lib/moonshot/types"
import { getScoringLabel } from "@/lib/scoring-labels"

type ReportSmartSummary = NonNullable<ReportDetailSnapshot["computed_analysis"]>

const ReportOverviewAnalytics = dynamic(
  () =>
    import("@/components/employer/report-overview-analytics").then((mod) => mod.ReportOverviewAnalytics),
  {
    ssr: false,
    loading: () => <ReportOverviewAnalyticsLoading />,
  },
)

function formatConfidence(value: unknown): string {
  if (value === null || value === undefined || value === "n/a") return "n/a"
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return `${Math.round(num * 100)}%`
}

function toSessionMode(value: unknown): SessionMode | undefined {
  if (
    value === "practice" ||
    value === "assessment" ||
    value === "assessment_no_ai" ||
    value === "assessment_ai_assisted"
  ) {
    return value
  }
  return undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

function getSmartSummary(snapshot: ReportDetailSnapshot): ReportSmartSummary {
  return snapshot.computed_analysis ?? {
    strengths: [],
    weaknesses: [],
    trend: "steady",
    confidenceLevel: "medium",
    hiringSuggestion: "lean-no",
    triggerSummary: { count: 0, codes: [] },
    overallScore: 0,
  }
}

function getDisplayOverallScore(snapshot: ReportDetailSnapshot, smartSummary: ReportSmartSummary): number {
  return snapshot.summary?.final_score_source === "human_override" &&
    typeof snapshot.human_review?.override_overall_score === "number"
    ? Math.round(snapshot.human_review.override_overall_score * 100)
    : smartSummary.overallScore
}

function getDimensionEvidence(snapshot: ReportDetailSnapshot): Record<string, unknown> | null {
  const scoreResult = asRecord(asRecord(snapshot.report)?.score_result)
  return asRecord(scoreResult?.dimension_evidence)
}

function ReportOverviewAnalyticsLoading() {
  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="report-overview-analytics-loading"
      className="ops-surface p-6"
    >
      <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Loading report analytics...</h2>
      <p className="mt-2 text-[13px] text-[var(--ops-text-subtle)]">
        Preparing charts, tool proficiency, and AI analysis.
      </p>
    </section>
  )
}

interface HumanReviewDraft {
  notesMarkdown: string
  tagsCsv: string
  dimensionOverridesJson: string
  overrideOverallScore: string
  overrideConfidence: string
}

function getInitialHumanReviewDraft(snapshot: ReportDetailSnapshot): HumanReviewDraft {
  return {
    notesMarkdown: snapshot.human_review?.notes_markdown ?? "",
    tagsCsv: snapshot.human_review?.tags.join(", ") ?? "",
    dimensionOverridesJson: snapshot.human_review?.dimension_overrides
      ? JSON.stringify(snapshot.human_review.dimension_overrides)
      : "",
    overrideOverallScore:
      snapshot.human_review?.override_overall_score === null ||
      snapshot.human_review?.override_overall_score === undefined
        ? ""
        : String(snapshot.human_review.override_overall_score),
    overrideConfidence:
      snapshot.human_review?.override_confidence === null ||
      snapshot.human_review?.override_confidence === undefined
        ? ""
        : String(snapshot.human_review.override_confidence),
  }
}

function getHumanReviewDraftKey(sessionId: string, snapshot: ReportDetailSnapshot): string {
  const initialDraft = getInitialHumanReviewDraft(snapshot)
  return [
    sessionId,
    initialDraft.notesMarkdown,
    initialDraft.tagsCsv,
    initialDraft.dimensionOverridesJson,
    initialDraft.overrideOverallScore,
    initialDraft.overrideConfidence,
  ].join("::")
}

function HumanReviewForm({
  sessionId,
  snapshot,
  humanFormAction,
  isHumanPending,
}: {
  sessionId: string
  snapshot: ReportDetailSnapshot
  humanFormAction: (payload: FormData) => void
  isHumanPending: boolean
}) {
  const notesFieldId = `human-review-notes-${sessionId}`
  const tagsFieldId = `human-review-tags-${sessionId}`
  const dimensionOverridesFieldId = `human-review-dimension-overrides-${sessionId}`
  const overrideScoreFieldId = `human-review-override-score-${sessionId}`
  const overrideConfidenceFieldId = `human-review-override-confidence-${sessionId}`
  const [draft, setDraft] = useState<HumanReviewDraft>(() => getInitialHumanReviewDraft(snapshot))

  return (
    <div className="ops-surface p-6">
      <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Human Notes &amp; Override</h2>
      <form action={humanFormAction} className="mt-4 space-y-3">
        <input type="hidden" name="session_id" value={sessionId} />
        <div>
          <Label htmlFor={notesFieldId} className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Notes (Markdown)</Label>
          <Textarea
            id={notesFieldId}
            name="notes_markdown"
            value={draft.notesMarkdown}
            onChange={(event) => setDraft((current) => ({ ...current, notesMarkdown: event.target.value }))}
            className="mt-1 min-h-[120px] rounded-3xl border-[var(--ops-border-strong)] bg-white px-4 py-3 text-[13px]"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={tagsFieldId} className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Tags (csv)</Label>
            <Input
              id={tagsFieldId}
              name="tags_csv"
              value={draft.tagsCsv}
              onChange={(event) => setDraft((current) => ({ ...current, tagsCsv: event.target.value }))}
              className="mt-1 h-11 rounded-2xl border-[var(--ops-border-strong)] bg-white text-[13px] md:h-9"
            />
          </div>
          <div>
            <Label htmlFor={dimensionOverridesFieldId} className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Dimension Overrides (JSON)</Label>
            <Input
              id={dimensionOverridesFieldId}
              name="dimension_overrides_json"
              value={draft.dimensionOverridesJson}
              onChange={(event) =>
                setDraft((current) => ({ ...current, dimensionOverridesJson: event.target.value }))
              }
              className="mt-1 h-11 rounded-2xl border-[var(--ops-border-strong)] bg-white text-[13px] md:h-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={overrideScoreFieldId} className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Override Overall Score (0-1)</Label>
            <Input
              id={overrideScoreFieldId}
              name="override_overall_score"
              value={draft.overrideOverallScore}
              onChange={(event) =>
                setDraft((current) => ({ ...current, overrideOverallScore: event.target.value }))
              }
              className="mt-1 h-11 rounded-2xl border-[var(--ops-border-strong)] bg-white text-[13px] md:h-9"
            />
          </div>
          <div>
            <Label htmlFor={overrideConfidenceFieldId} className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Override Confidence (0-1)</Label>
            <Input
              id={overrideConfidenceFieldId}
              name="override_confidence"
              value={draft.overrideConfidence}
              onChange={(event) =>
                setDraft((current) => ({ ...current, overrideConfidence: event.target.value }))
              }
              className="mt-1 h-11 rounded-2xl border-[var(--ops-border-strong)] bg-white text-[13px] md:h-9"
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={isHumanPending}
          className="min-h-11 bg-[var(--ops-accent)] px-5 text-[12px] text-white hover:bg-[var(--ops-accent-strong)]"
        >
          {isHumanPending ? "Saving..." : "Save Human Review"}
        </Button>
      </form>
    </div>
  )
}

function ScoreCredibilityCard({ snapshot }: { snapshot: ReportDetailSnapshot }) {
  const scoringLock = snapshot.summary?.scoring_version_lock
  const governance = snapshot.governance_trace
  const humanReviewStatus =
    snapshot.summary?.has_human_review ? "saved" : snapshot.summary?.needs_human_review ? "required" : "clear"

  const items = [
    { label: "Scorer", value: scoringLock?.scorer_version ?? "n/a" },
    { label: "Task family", value: scoringLock?.task_family_version ?? "n/a" },
    { label: "Audit chain", value: governance?.audit_chain_status ?? "unavailable" },
    { label: "Human review", value: humanReviewStatus },
    { label: "Fairness runs", value: String(governance?.fairness_run_count ?? 0) },
    { label: "Red-team runs", value: String(governance?.redteam_run_count ?? 0) },
  ]

  return (
    <div data-testid="credibility-block" className="ops-surface p-6">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="size-5 text-[var(--ops-success)]" />
        <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Why this score is credible</h2>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ops-text-muted)]">
        This report combines locked scoring provenance, auditable evidence, and explicit reviewer/governance signals in one place.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="ops-surface-soft px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-success)]">{item.label}</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--ops-text)]">{item.value}</p>
          </div>
        ))}
      </div>
      {governance ? (
        <p className="mt-4 text-[12px] leading-relaxed text-[var(--ops-success)]">{governance.audit_chain_detail}</p>
      ) : null}
    </div>
  )
}

export function ReportOverviewTab({
  sessionId,
  snapshot,
  humanFormAction,
  isHumanPending,
  practiceState,
  practiceFormAction,
  isPracticePending,
}: {
  sessionId: string
  snapshot: ReportDetailSnapshot
  humanFormAction: (payload: FormData) => void
  isHumanPending: boolean
  practiceState: PracticeRetryActionState
  practiceFormAction: (payload: FormData) => void
  isPracticePending: boolean
}) {
  const scoringLabel = getScoringLabel(toSessionMode(snapshot.session?.policy?.coach_mode))
  const smartSummary = getSmartSummary(snapshot)
  const activeTemplate = DEMO_CASE_TEMPLATES.find((item) => item.id === snapshot.demo_template_id) ?? null
  const displayOverallScore = getDisplayOverallScore(snapshot, smartSummary)

  return (
    <section className="space-y-6">
      <div className="ops-surface p-6">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-5 text-[var(--ops-accent)]" />
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Report Summary</h2>
          <Badge variant="outline" className={`ml-auto text-[11px] ${scoringLabel.className}`}>
            {scoringLabel.label}
          </Badge>
        </div>
        {scoringLabel.warning && <p className="mt-2 text-[11px] text-[var(--ops-warning)]">{scoringLabel.warning}</p>}
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Status</p>
            <div className="mt-0.5">
              <Badge variant="outline" className="text-[11px]">{snapshot.summary?.session_status ?? "n/a"}</Badge>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Confidence</p>
            <p className="mt-0.5 text-[13px] text-[var(--ops-text)]">
              {formatConfidence(snapshot.summary?.confidence)}
              {snapshot.summary?.final_confidence && snapshot.summary.final_confidence !== snapshot.summary.confidence
                ? ` → ${formatConfidence(snapshot.summary.final_confidence)}`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Template</p>
            <p className="mt-0.5 text-[13px] text-[var(--ops-text)]">
              {activeTemplate ? activeTemplate.title : (snapshot.demo_template_id ?? "n/a")}
            </p>
            {activeTemplate ? (
              <p className="mt-0.5 text-[11px] text-[var(--ops-text-subtle)]">{activeTemplate.role}</p>
            ) : null}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Human Review</p>
            <div className="mt-0.5">
              {snapshot.summary?.has_human_review ? (
                <Badge variant="outline" className="border-[var(--ops-success)]/30 bg-[var(--ops-success-soft)] text-[var(--ops-success)] text-[11px]">Saved</Badge>
              ) : snapshot.summary?.needs_human_review ? (
                <Badge variant="outline" className="border-[var(--ops-warning)]/30 bg-[var(--ops-warning-soft)] text-[var(--ops-warning)] text-[11px]">Required</Badge>
              ) : (
                <Badge variant="outline" className="text-[11px]">Clear</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Score source</p>
          <p className="mt-0.5 text-[13px] text-[var(--ops-text)]">{snapshot.summary?.final_score_source ?? "n/a"}</p>
        </div>
      </div>

      <ScoreCredibilityCard snapshot={snapshot} />

      <div className="ops-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Practice Retry</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--ops-text-muted)]">
              Launch a derived practice-mode retry from this report. The retry reuses the same template and task family,
              disables oral scoring, and preserves a separate evidence trail for before-and-after comparison.
            </p>
          </div>
          {practiceState.practiceUrl ? (
            <Button asChild className="min-h-11 bg-[var(--ops-accent)] px-5 text-[12px] text-white hover:bg-[var(--ops-accent-strong)]">
              <a href={practiceState.practiceUrl}>Open Practice Retry</a>
            </Button>
          ) : null}
        </div>
        <form action={practiceFormAction} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="session_id" value={sessionId} />
          <Button
            type="submit"
            disabled={isPracticePending}
            variant="outline"
            className="min-h-11 px-5 text-[12px]"
          >
            {isPracticePending ? "Creating practice retry..." : "Create Practice Retry"}
          </Button>
          {practiceState.message ? (
            <p className="text-[12px] text-[var(--ops-text-subtle)]">{practiceState.message}</p>
          ) : null}
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="ops-surface p-6">
          <div className="flex items-center gap-2">
            <BrainIcon className="size-5 text-[var(--ops-accent)]" />
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Approach Narrative</h2>
          </div>
          {snapshot.approach_narrative ? (
            <>
              <p className="mt-3 text-[16px] font-semibold text-[var(--ops-text)]">{snapshot.approach_narrative.headline}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ops-text-muted)]">{snapshot.approach_narrative.summary}</p>
              {snapshot.approach_narrative.final_recommendation ? (
                <div className="ops-surface-soft mt-4 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Final Recommendation</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--ops-text)]">
                    {snapshot.approach_narrative.final_recommendation}
                  </p>
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {snapshot.approach_narrative.key_evidence_moments.map((moment) => (
                  <div key={`${moment.event_type}-${moment.timestamp ?? "n/a"}`} className="ops-surface-soft p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[var(--ops-text)]">{moment.title}</p>
                      <Badge variant="outline" className="font-mono text-[10px]">{moment.event_type}</Badge>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--ops-text-muted)]">{moment.detail}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--ops-text-subtle)]">Approach narrative unavailable for this report.</p>
          )}
        </div>

        <div className="ops-surface p-6">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-[var(--ops-success)]" />
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Governance Trace</h2>
          </div>
          {snapshot.governance_trace ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Audit Chain</p>
                  <p className="mt-1 text-[13px] text-[var(--ops-text)]">{snapshot.governance_trace.audit_chain_status}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Human Review</p>
                  <p className="mt-1 text-[13px] text-[var(--ops-text)]">{snapshot.governance_trace.human_review_status}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Context Traces</p>
                  <p className="mt-1 text-[13px] text-[var(--ops-text)]">{snapshot.governance_trace.context_trace_count}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Timeline Source</p>
                  <p className="mt-1 text-[13px] text-[var(--ops-text)]">{snapshot.governance_trace.timeline_source}</p>
                </div>
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-[var(--ops-text-muted)]">
                {snapshot.governance_trace.audit_chain_detail}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {snapshot.governance_trace.context_agents.map((agent) => (
                  <Badge key={agent} variant="outline" className="text-[11px]">{agent}</Badge>
                ))}
                {snapshot.governance_trace.context_keys.slice(0, 3).map((key) => (
                  <Badge key={key} variant="outline" className="text-[11px]">{key}</Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--ops-text-subtle)]">Governance trace unavailable for this report.</p>
          )}
        </div>
      </div>

      <ReportOverviewAnalytics
        sessionId={sessionId}
        snapshot={snapshot}
        displayOverallScore={displayOverallScore}
        smartSummary={smartSummary}
      />

      <HumanReviewForm
        key={getHumanReviewDraftKey(sessionId, snapshot)}
        sessionId={sessionId}
        snapshot={snapshot}
        humanFormAction={humanFormAction}
        isHumanPending={isHumanPending}
      />
    </section>
  )
}

export function ReportOutputTab({ snapshot }: { snapshot: ReportDetailSnapshot }) {
  const dimensionEvidence = getDimensionEvidence(snapshot)
  const oralResponses = snapshot.oral_responses
  const artifactRefs = [...new Set(
    snapshot.round_blueprint.flatMap((round) => [
      ...round.mockedArtifacts,
      ...getRoundToolActions(round).flatMap((action) => action.artifactRefs ?? []),
    ]),
  )]
  const supervisorLog = snapshot.round_blueprint.flatMap((round) =>
    round.coachScript.map((item, index) => ({
      id: `${round.id}-${index}`,
      roundTitle: round.title,
      role: item.role,
      content: item.content,
      allowed: item.allowed,
      policyReason: item.policyReason,
    })),
  )
  const revisionHistory = snapshot.events.filter((event) =>
    ["checkpoint_saved", "deliverable_draft_saved", "copilot_output_accepted", "copilot_output_edited"].includes(event.event_type),
  )
  const aiTrace = snapshot.events.filter((event) =>
    ["copilot_invoked", "copilot_output_accepted", "copilot_output_edited", "coach_message"].includes(event.event_type),
  )

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <CodeIcon className="size-5 text-[var(--ops-text-subtle)]" />
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Candidate Output</h2>
        </div>
        {snapshot.session?.final_response ? (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--ops-page-bg)] p-4 font-mono text-[13px] text-[var(--ops-text)]">
            {snapshot.session.final_response}
          </pre>
        ) : (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CodeIcon /></EmptyMedia>
              <EmptyTitle>No response submitted</EmptyTitle>
              <EmptyDescription>The candidate has not submitted a final response for this session.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      {oralResponses.length > 0 && (
        <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BrainIcon className="size-5 text-[var(--ops-success)]" />
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Oral Defense Evidence</h2>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ops-text-subtle)]">
            Presentation and follow-up responses were transcribed, attached to the session evidence graph, and scored alongside the written work.
          </p>
          <div className="mt-4 grid gap-3">
            {oralResponses.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--ops-success)]/20 bg-[var(--ops-success-soft)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-[var(--ops-success)]/30 bg-white text-[11px] text-[var(--ops-success)]">
                    {item.clip_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-[11px] text-[var(--ops-text-subtle)]">
                    {Math.round(item.duration_ms / 1000)}s · {item.transcription_model}
                  </span>
                  <span className="text-[11px] text-[var(--ops-text-subtle)]">
                    {item.audio_retained ? "audio retained" : "audio discarded"}
                  </span>
                </div>
                {item.question_id ? (
                  <p className="mt-2 text-[12px] font-medium text-[var(--ops-text)]">Question: {item.question_id}</p>
                ) : null}
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ops-text)]">{item.transcript_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshot.evaluation_bundle && (
        <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Trigger and Rationale</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--ops-border)]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[var(--ops-page-bg)] text-[var(--ops-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Rationale</th>
                  <th className="px-3 py-2 font-medium">Impact</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.evaluation_bundle.triggerRationale.map((item) => (
                  <tr key={item.code} className="border-t border-[var(--ops-border)]/50">
                    <td className="px-3 py-2 font-mono text-[var(--ops-text)]">{item.code}</td>
                    <td className="px-3 py-2 text-[var(--ops-text-subtle)]">{item.rationale}</td>
                    <td className="px-3 py-2 text-[var(--ops-text)]">{item.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dimensionEvidence && Object.keys(dimensionEvidence).length > 0 && (
        <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Dimension Evidence</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--ops-border)]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[var(--ops-page-bg)] text-[var(--ops-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Dimension</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Confidence</th>
                  <th className="px-3 py-2 font-medium">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(dimensionEvidence).map(([key, value]) => {
                  const item = asRecord(value)
                  return (
                    <tr key={key} className="border-t border-[var(--ops-border)]/50">
                      <td className="px-3 py-2 text-[var(--ops-text)]">{key}</td>
                      <td className="px-3 py-2 text-[var(--ops-text)]">{String(item?.score ?? "n/a")}</td>
                      <td className="px-3 py-2 text-[var(--ops-text)]">{String(item?.confidence ?? "n/a")}</td>
                      <td className="px-3 py-2 text-[var(--ops-text-subtle)]">{String(item?.rationale ?? "n/a")}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {artifactRefs.length > 0 && (
        <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Artifact Inventory</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ops-text-subtle)]">
            Frozen artifacts, generated drafts, and tool-linked outputs available for sponsor replay.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {artifactRefs.map((artifact) => (
              <Badge key={artifact} variant="outline" className="text-[11px]">
                {artifact}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {supervisorLog.length > 0 && (
        <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Supervisor / Coach Log</h2>
          <div className="mt-4 grid gap-3">
            {supervisorLog.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--ops-border)]/70 bg-[var(--ops-surface-muted)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">{item.roundTitle}</Badge>
                  <Badge variant="outline" className="text-[11px]">{item.role}</Badge>
                  {item.allowed === false ? (
                    <Badge variant="outline" className="border-[var(--ops-warning)]/40 bg-[var(--ops-warning)]/10 text-[11px] text-[var(--ops-warning)]">
                      blocked
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ops-text)]">{item.content}</p>
                {item.policyReason ? (
                  <p className="mt-2 text-[12px] text-[var(--ops-text-subtle)]">{item.policyReason}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {(revisionHistory.length > 0 || aiTrace.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Revision History</h2>
            <div className="mt-4 space-y-2">
              {revisionHistory.length > 0 ? revisionHistory.map((event, index) => (
                <div key={`${event.event_type}-${event.timestamp ?? index}`} className="rounded-xl bg-[var(--ops-surface-muted)] px-3 py-3">
                  <p className="text-[12px] font-semibold text-[var(--ops-text)]">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-[12px] text-[var(--ops-text-subtle)]">{JSON.stringify(event.payload)}</p>
                </div>
              )) : (
                <p className="text-[13px] text-[var(--ops-text-subtle)]">No revision events captured.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">AI / Tool Trace</h2>
            <div className="mt-4 space-y-2">
              {aiTrace.length > 0 ? aiTrace.map((event, index) => (
                <div key={`${event.event_type}-${event.timestamp ?? index}`} className="rounded-xl bg-[var(--ops-surface-muted)] px-3 py-3">
                  <p className="text-[12px] font-semibold text-[var(--ops-text)]">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-[12px] text-[var(--ops-text-subtle)]">{JSON.stringify(event.payload)}</p>
                </div>
              )) : (
                <p className="text-[13px] text-[var(--ops-text-subtle)]">No AI trace captured.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function ReportIntegrityTab({
  snapshot,
  integrityTier,
  onIntegrityTierChange,
}: {
  snapshot: ReportDetailSnapshot
  integrityTier: IntegrityTier
  onIntegrityTierChange: (value: IntegrityTier) => void
}) {
  const sessionStartedAt = snapshot.session?.created_at ?? new Date().toISOString()

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Event Timeline</h2>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--ops-text-subtle)]">Source</span>
            <Badge variant="outline" className="text-[11px]">{snapshot.timeline_source}</Badge>
          </div>
        </div>
        {snapshot.timeline_warning ? (
          <div className="mb-4 rounded-lg border border-[var(--ops-warning)]/40 bg-[var(--ops-warning)]/10 px-3 py-2 text-[12px] text-[var(--ops-warning)]">
            {snapshot.timeline_warning}
          </div>
        ) : null}
        <div className="mb-4">
          <IntegrityTierSelect value={integrityTier} onChange={onIntegrityTierChange} />
        </div>
        <EventTimeline events={snapshot.events} sessionStartedAt={sessionStartedAt} integrityTier={integrityTier} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-[var(--ops-text-subtle)]" />
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Red-Team Runs</h2>
          </div>
          <div className="mt-3 space-y-2">
            {snapshot.redteamRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-2 text-[12px]">
                <Badge variant="outline" className="text-[11px]">{run.status}</Badge>
                <span className="font-mono text-[var(--ops-text)]">{run.id.slice(0, 8)}</span>
                <span className="text-[var(--ops-text-subtle)]">{run.findings.length} findings</span>
              </div>
            ))}
            {snapshot.redteamRuns.length === 0 && (
              <Empty className="py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><ShieldCheckIcon /></EmptyMedia>
                  <EmptyTitle>No red-team runs</EmptyTitle>
                  <EmptyDescription>Red-team runs will appear here once linked to this session.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ScaleIcon className="size-5 text-[var(--ops-text-subtle)]" />
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Fairness Runs</h2>
          </div>
          <div className="mt-3 space-y-2">
            {snapshot.fairnessRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-2 text-[12px]">
                <Badge variant="outline" className="text-[11px]">{run.status}</Badge>
                <span className="font-mono text-[var(--ops-text)]">{run.id.slice(0, 8)}</span>
                <span className="text-[var(--ops-text-subtle)]">Sample: {String(run.summary["sample_size"] ?? "n/a")}</span>
              </div>
            ))}
            {snapshot.fairnessRuns.length === 0 && (
              <Empty className="py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><ScaleIcon /></EmptyMedia>
                  <EmptyTitle>No fairness runs</EmptyTitle>
                  <EmptyDescription>Fairness runs will appear here once linked to this session.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function ReportProvenanceTab({
  sessionId,
  snapshot,
}: {
  sessionId: string
  snapshot: ReportDetailSnapshot
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <LinkIcon className="size-5 text-[var(--ops-text-subtle)]" />
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Scoring Version Lock</h2>
        </div>
        {snapshot.summary?.scoring_version_lock ? (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Scorer Version</p>
              <p className="mt-0.5 font-mono text-[13px] text-[var(--ops-text)]">{snapshot.summary.scoring_version_lock.scorer_version}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Rubric Version</p>
              <p className="mt-0.5 font-mono text-[13px] text-[var(--ops-text)]">{snapshot.summary.scoring_version_lock.rubric_version}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Task Family Version</p>
              <p className="mt-0.5 font-mono text-[13px] text-[var(--ops-text)]">{snapshot.summary.scoring_version_lock.task_family_version}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Model Hash</p>
              <p className="mt-0.5 font-mono text-[13px] text-[var(--ops-text)]">{snapshot.summary.scoring_version_lock.model_hash}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-[var(--ops-text-subtle)]">No scoring version lock available.</p>
        )}
      </div>

      {snapshot.summary?.trigger_codes && snapshot.summary.trigger_codes.length > 0 && (
        <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Trigger Codes</h2>
          <p className="mt-1 text-[11px] text-[var(--ops-text-subtle)]">{snapshot.summary.trigger_count} trigger(s) detected</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {snapshot.summary.trigger_codes.map((code) => (
              <Badge key={code} variant="outline" className="font-mono text-[11px]">{code}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--ops-border)] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Audit Trail</h2>
        {snapshot.governance_trace ? (
          <>
            <p className="mt-2 text-[13px] text-[var(--ops-text-subtle)]">
              {snapshot.governance_trace.audit_chain_detail}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-muted)] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Entries Reviewed</p>
                <p className="mt-1 text-[13px] text-[var(--ops-text)]">{snapshot.governance_trace.audit_checked_entries}</p>
              </div>
              <div className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-muted)] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Report Audit Entries</p>
                <p className="mt-1 text-[13px] text-[var(--ops-text)]">{snapshot.governance_trace.audit_entry_count}</p>
              </div>
              <div className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-muted)] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Red-Team Runs</p>
                <p className="mt-1 text-[13px] text-[var(--ops-text)]">{snapshot.governance_trace.redteam_run_count}</p>
              </div>
              <div className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-muted)] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Fairness Runs</p>
                <p className="mt-1 text-[13px] text-[var(--ops-text)]">{snapshot.governance_trace.fairness_run_count}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-[var(--ops-text-subtle)]">
            Session <span className="font-mono">{sessionId}</span> has no governance trace available.
          </p>
        )}
      </div>
    </section>
  )
}
