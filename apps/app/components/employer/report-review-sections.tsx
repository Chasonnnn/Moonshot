"use client"

import dynamic from "next/dynamic"
import { CodeIcon, FileTextIcon, LinkIcon, BrainIcon, ScaleIcon, ShieldCheckIcon } from "lucide-react"

import type { ReportDetailSnapshot } from "@/actions/reports"
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
      className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm"
    >
      <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Loading report analytics...</h2>
      <p className="mt-2 text-[13px] text-[#6E6E73]">
        Preparing charts, tool proficiency, and AI analysis.
      </p>
    </section>
  )
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
  return (
    <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
      <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Human Notes &amp; Override</h2>
      <form action={humanFormAction} className="mt-4 space-y-3">
        <input type="hidden" name="session_id" value={sessionId} />
        <div>
          <Label className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Notes (Markdown)</Label>
          <Textarea
            name="notes_markdown"
            defaultValue={snapshot.human_review?.notes_markdown ?? ""}
            className="mt-1 min-h-[120px] rounded-lg text-[13px]"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Tags (csv)</Label>
            <Input
              name="tags_csv"
              defaultValue={snapshot.human_review?.tags.join(", ") ?? ""}
              className="mt-1 h-9 rounded-lg text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Dimension Overrides (JSON)</Label>
            <Input
              name="dimension_overrides_json"
              defaultValue={
                snapshot.human_review?.dimension_overrides
                  ? JSON.stringify(snapshot.human_review.dimension_overrides)
                  : ""
              }
              className="mt-1 h-9 rounded-lg text-[13px]"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Override Overall Score (0-1)</Label>
            <Input
              name="override_overall_score"
              defaultValue={snapshot.human_review?.override_overall_score ?? ""}
              className="mt-1 h-9 rounded-lg text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Override Confidence (0-1)</Label>
            <Input
              name="override_confidence"
              defaultValue={snapshot.human_review?.override_confidence ?? ""}
              className="mt-1 h-9 rounded-lg text-[13px]"
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={isHumanPending}
          size="sm"
          className="text-[12px]"
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
    <div data-testid="credibility-block" className="rounded-[28px] border border-[#10B981]/16 bg-[linear-gradient(160deg,rgba(16,185,129,0.10),rgba(255,255,255,0.96))] p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="size-5 text-[#047857]" />
        <h2 className="text-[18px] font-semibold text-[#0F172A]">Why this score is credible</h2>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[#334155]">
        This report combines locked scoring provenance, auditable evidence, and explicit reviewer/governance signals in one place.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/60 bg-white/85 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#047857]">{item.label}</p>
            <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">{item.value}</p>
          </div>
        ))}
      </div>
      {governance ? (
        <p className="mt-4 text-[12px] leading-relaxed text-[#065F46]">{governance.audit_chain_detail}</p>
      ) : null}
    </div>
  )
}

export function ReportOverviewTab({
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
  const scoringLabel = getScoringLabel(toSessionMode(snapshot.session?.policy?.coach_mode))
  const smartSummary = getSmartSummary(snapshot)
  const activeTemplate = DEMO_CASE_TEMPLATES.find((item) => item.id === snapshot.demo_template_id) ?? null
  const displayOverallScore = getDisplayOverallScore(snapshot, smartSummary)

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-[#BFDBFE] bg-[linear-gradient(150deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98))] p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-5 text-[#2563EB]" />
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Report Summary</h2>
          <Badge variant="outline" className={`ml-auto text-[11px] ${scoringLabel.className}`}>
            {scoringLabel.label}
          </Badge>
        </div>
        {scoringLabel.warning && <p className="mt-2 text-[11px] text-[#FF9F0A]">{scoringLabel.warning}</p>}
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Status</p>
            <div className="mt-0.5">
              <Badge variant="outline" className="text-[11px]">{snapshot.summary?.session_status ?? "n/a"}</Badge>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Confidence</p>
            <p className="mt-0.5 text-[13px] text-[#1D1D1F]">{formatConfidence(snapshot.summary?.confidence)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Final Confidence</p>
            <p className="mt-0.5 text-[13px] text-[#1D1D1F]">{formatConfidence(snapshot.summary?.final_confidence)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Template</p>
            <p className="mt-0.5 text-[13px] text-[#1D1D1F]">
              {activeTemplate ? activeTemplate.title : (snapshot.demo_template_id ?? "n/a")}
            </p>
            {activeTemplate ? (
              <p className="mt-0.5 text-[11px] text-[#6E6E73]">{activeTemplate.role}</p>
            ) : null}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Human Review</p>
            <div className="mt-0.5">
              {snapshot.summary?.has_human_review ? (
                <Badge variant="outline" className="border-[#34C759]/40 bg-[#34C759]/10 text-[#0D8A2A] text-[11px]">Saved</Badge>
              ) : snapshot.summary?.needs_human_review ? (
                <Badge variant="outline" className="border-[#FF9F0A]/40 bg-[#FF9F0A]/10 text-[#FF9F0A] text-[11px]">Required</Badge>
              ) : (
                <Badge variant="outline" className="text-[11px]">Clear</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Final Score Source</p>
            <p className="mt-0.5 text-[13px] text-[#1D1D1F]">{snapshot.summary?.final_score_source ?? "n/a"}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Model Confidence</p>
            <p className="mt-0.5 text-[13px] text-[#1D1D1F]">{formatConfidence(snapshot.summary?.confidence)}</p>
          </div>
        </div>
      </div>

      <ScoreCredibilityCard snapshot={snapshot} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="rounded-[28px] border border-[#DBEAFE] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BrainIcon className="size-5 text-[#2563EB]" />
            <h2 className="text-[18px] font-semibold text-[#0F172A]">Approach Narrative</h2>
          </div>
          {snapshot.approach_narrative ? (
            <>
              <p className="mt-3 text-[16px] font-semibold text-[#1D1D1F]">{snapshot.approach_narrative.headline}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#4D4D52]">{snapshot.approach_narrative.summary}</p>
              {snapshot.approach_narrative.final_recommendation ? (
                <div className="mt-4 rounded-2xl border border-[#DBEAFE] bg-[#F8FAFC] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Final Recommendation</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#1D1D1F]">
                    {snapshot.approach_narrative.final_recommendation}
                  </p>
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {snapshot.approach_narrative.key_evidence_moments.map((moment) => (
                  <div key={`${moment.event_type}-${moment.timestamp ?? "n/a"}`} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[#1D1D1F]">{moment.title}</p>
                      <Badge variant="outline" className="font-mono text-[10px]">{moment.event_type}</Badge>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#4D4D52]">{moment.detail}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-[#6E6E73]">Approach narrative unavailable for this report.</p>
          )}
        </div>

        <div className="rounded-[28px] border border-[#D1FAE5] bg-[#F8FFFC] p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-[#047857]" />
            <h2 className="text-[18px] font-semibold text-[#0F172A]">Governance Trace</h2>
          </div>
          {snapshot.governance_trace ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Audit Chain</p>
                  <p className="mt-1 text-[13px] text-[#1D1D1F]">{snapshot.governance_trace.audit_chain_status}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Human Review</p>
                  <p className="mt-1 text-[13px] text-[#1D1D1F]">{snapshot.governance_trace.human_review_status}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Context Traces</p>
                  <p className="mt-1 text-[13px] text-[#1D1D1F]">{snapshot.governance_trace.context_trace_count}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Timeline Source</p>
                  <p className="mt-1 text-[13px] text-[#1D1D1F]">{snapshot.governance_trace.timeline_source}</p>
                </div>
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-[#4D4D52]">
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
            <p className="mt-3 text-[13px] text-[#6E6E73]">Governance trace unavailable for this report.</p>
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

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <CodeIcon className="size-5 text-[#6E6E73]" />
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Candidate Output</h2>
        </div>
        {snapshot.session?.final_response ? (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#F5F5F7] p-4 font-mono text-[13px] text-[#1D1D1F]">
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
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BrainIcon className="size-5 text-[#0F766E]" />
            <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Oral Defense Evidence</h2>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[#6E6E73]">
            Presentation and follow-up responses were transcribed, attached to the session evidence graph, and scored alongside the written work.
          </p>
          <div className="mt-4 grid gap-3">
            {oralResponses.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[#CCFBF1] bg-[#F0FDFA] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-[#99F6E4] bg-white text-[11px] text-[#115E59]">
                    {item.clip_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-[11px] text-[#0F766E]">
                    {Math.round(item.duration_ms / 1000)}s · {item.transcription_model}
                  </span>
                  {item.request_id ? (
                    <span className="font-mono text-[11px] text-[#134E4A]">request_id={item.request_id}</span>
                  ) : null}
                  <span className="text-[11px] text-[#134E4A]">
                    raw audio {item.audio_retained ? "retained" : "discarded after transcription"}
                  </span>
                </div>
                {item.question_id ? (
                  <p className="mt-2 text-[12px] font-medium text-[#0F172A]">Question: {item.question_id}</p>
                ) : null}
                <p className="mt-2 text-[13px] leading-relaxed text-[#0F172A]">{item.transcript_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshot.evaluation_bundle && (
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Trigger and Rationale</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#E5E5EA]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#F5F5F7] text-[#4D4D52]">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Rationale</th>
                  <th className="px-3 py-2 font-medium">Impact</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.evaluation_bundle.triggerRationale.map((item) => (
                  <tr key={item.code} className="border-t border-[#F0F0F2]">
                    <td className="px-3 py-2 font-mono text-[#1D1D1F]">{item.code}</td>
                    <td className="px-3 py-2 text-[#6E6E73]">{item.rationale}</td>
                    <td className="px-3 py-2 text-[#1D1D1F]">{item.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dimensionEvidence && Object.keys(dimensionEvidence).length > 0 && (
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Dimension Evidence</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#E5E5EA]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#F5F5F7] text-[#4D4D52]">
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
                    <tr key={key} className="border-t border-[#F0F0F2]">
                      <td className="px-3 py-2 text-[#1D1D1F]">{key}</td>
                      <td className="px-3 py-2 text-[#1D1D1F]">{String(item?.score ?? "n/a")}</td>
                      <td className="px-3 py-2 text-[#1D1D1F]">{String(item?.confidence ?? "n/a")}</td>
                      <td className="px-3 py-2 text-[#6E6E73]">{String(item?.rationale ?? "n/a")}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Event Timeline</h2>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#6E6E73]">Source</span>
            <Badge variant="outline" className="text-[11px]">{snapshot.timeline_source}</Badge>
          </div>
        </div>
        {snapshot.timeline_warning ? (
          <div className="mb-4 rounded-lg border border-[#FF9F0A]/40 bg-[#FF9F0A]/10 px-3 py-2 text-[12px] text-[#A05A00]">
            {snapshot.timeline_warning}
          </div>
        ) : null}
        <div className="mb-4">
          <IntegrityTierSelect value={integrityTier} onChange={onIntegrityTierChange} />
        </div>
        <EventTimeline events={snapshot.events} sessionStartedAt={sessionStartedAt} integrityTier={integrityTier} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-[#6E6E73]" />
            <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Red-Team Runs</h2>
          </div>
          <div className="mt-3 space-y-2">
            {snapshot.redteamRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-2 text-[12px]">
                <Badge variant="outline" className="text-[11px]">{run.status}</Badge>
                <span className="font-mono text-[#1D1D1F]">{run.id.slice(0, 8)}</span>
                <span className="text-[#6E6E73]">{run.findings.length} findings</span>
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
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ScaleIcon className="size-5 text-[#6E6E73]" />
            <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Fairness Runs</h2>
          </div>
          <div className="mt-3 space-y-2">
            {snapshot.fairnessRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-2 text-[12px]">
                <Badge variant="outline" className="text-[11px]">{run.status}</Badge>
                <span className="font-mono text-[#1D1D1F]">{run.id.slice(0, 8)}</span>
                <span className="text-[#6E6E73]">Sample: {String(run.summary["sample_size"] ?? "n/a")}</span>
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
      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <LinkIcon className="size-5 text-[#6E6E73]" />
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Scoring Version Lock</h2>
        </div>
        {snapshot.summary?.scoring_version_lock ? (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Scorer Version</p>
              <p className="mt-0.5 font-mono text-[13px] text-[#1D1D1F]">{snapshot.summary.scoring_version_lock.scorer_version}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Rubric Version</p>
              <p className="mt-0.5 font-mono text-[13px] text-[#1D1D1F]">{snapshot.summary.scoring_version_lock.rubric_version}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Task Family Version</p>
              <p className="mt-0.5 font-mono text-[13px] text-[#1D1D1F]">{snapshot.summary.scoring_version_lock.task_family_version}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Model Hash</p>
              <p className="mt-0.5 font-mono text-[13px] text-[#1D1D1F]">{snapshot.summary.scoring_version_lock.model_hash}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-[#6E6E73]">No scoring version lock available.</p>
        )}
      </div>

      {snapshot.summary?.trigger_codes && snapshot.summary.trigger_codes.length > 0 && (
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Trigger Codes</h2>
          <p className="mt-1 text-[11px] text-[#6E6E73]">{snapshot.summary.trigger_count} trigger(s) detected</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {snapshot.summary.trigger_codes.map((code) => (
              <Badge key={code} variant="outline" className="font-mono text-[11px]">{code}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Audit Trail</h2>
        {snapshot.governance_trace ? (
          <>
            <p className="mt-2 text-[13px] text-[#6E6E73]">
              {snapshot.governance_trace.audit_chain_detail}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[#E5E5EA] bg-[#FAFAFB] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Entries Reviewed</p>
                <p className="mt-1 text-[13px] text-[#1D1D1F]">{snapshot.governance_trace.audit_checked_entries}</p>
              </div>
              <div className="rounded-lg border border-[#E5E5EA] bg-[#FAFAFB] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Report Audit Entries</p>
                <p className="mt-1 text-[13px] text-[#1D1D1F]">{snapshot.governance_trace.audit_entry_count}</p>
              </div>
              <div className="rounded-lg border border-[#E5E5EA] bg-[#FAFAFB] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Red-Team Runs</p>
                <p className="mt-1 text-[13px] text-[#1D1D1F]">{snapshot.governance_trace.redteam_run_count}</p>
              </div>
              <div className="rounded-lg border border-[#E5E5EA] bg-[#FAFAFB] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Fairness Runs</p>
                <p className="mt-1 text-[13px] text-[#1D1D1F]">{snapshot.governance_trace.fairness_run_count}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-[#6E6E73]">
            Session <span className="font-mono">{sessionId}</span> has no governance trace available.
          </p>
        )}
      </div>
    </section>
  )
}
