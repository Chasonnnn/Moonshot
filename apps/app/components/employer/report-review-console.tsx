"use client"

import { useActionState, useState } from "react"
import { FileTextIcon, SparklesIcon, ShieldCheckIcon, ScaleIcon, CodeIcon, LinkIcon } from "lucide-react"

import { createInterpretationAction, type ReportActionState, type ReportDetailSnapshot } from "@/actions/reports"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EventTimeline } from "@/components/employer/event-timeline"
import { IntegrityTierSelect } from "@/components/employer/integrity-tier-select"
import type { IntegrityTier } from "@/lib/integrity-tiers"
import { getScoringLabel } from "@/lib/scoring-labels"

const initialReportActionState: ReportActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

function formatConfidence(value: unknown): string {
  if (value === null || value === undefined || value === "n/a") return "n/a"
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return `${Math.round(num * 100)}%`
}

export function ReportReviewConsole({ sessionId, snapshot }: { sessionId: string; snapshot: ReportDetailSnapshot }) {
  const [state, formAction, isPending] = useActionState(createInterpretationAction, initialReportActionState)
  const [integrityTier, setIntegrityTier] = useState<IntegrityTier>("standard")
  useActionStateToast(state)

  if (snapshot.error) {
    return (
      <section className="rounded-2xl border border-[#FF9F0A] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Report View Unavailable</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">{snapshot.error}</p>
      </section>
    )
  }

  const scoringLabel = getScoringLabel(snapshot.session?.policy?.coach_mode)
  const sessionStartedAt = snapshot.session?.created_at ?? new Date().toISOString()

  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-4 w-fit">
        <TabsTrigger value="overview" className="text-[12px]">Overview</TabsTrigger>
        <TabsTrigger value="output" className="text-[12px]">Output</TabsTrigger>
        <TabsTrigger value="integrity" className="text-[12px]">Integrity</TabsTrigger>
        <TabsTrigger value="provenance" className="text-[12px]">Provenance</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview">
        <section className="space-y-6">
          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-5 text-[#6E6E73]" />
              <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Report Summary</h2>
              <Badge variant="outline" className={`ml-auto text-[11px] ${scoringLabel.className}`}>
                {scoringLabel.label}
              </Badge>
            </div>
            {scoringLabel.warning && (
              <p className="mt-2 text-[11px] text-[#FF9F0A]">{scoringLabel.warning}</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
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
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Human Review</p>
                <div className="mt-0.5">
                  {snapshot.summary?.needs_human_review === null || snapshot.summary?.needs_human_review === undefined ? (
                    <span className="text-[13px] text-[#6E6E73]">n/a</span>
                  ) : (
                    <Badge
                      variant="outline"
                      className={snapshot.summary.needs_human_review
                        ? "border-[#FF9F0A]/40 bg-[#FF9F0A]/10 text-[#FF9F0A] text-[11px]"
                        : "text-[11px]"}
                    >
                      {snapshot.summary.needs_human_review ? "Required" : "Clear"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-5 text-[#6E6E73]" />
              <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Interpretation</h2>
            </div>
            {(snapshot.report?.interpretation as { summary?: string } | undefined)?.summary ? (
              <p className="mt-2 text-[13px] text-[#1D1D1F]">
                {(snapshot.report?.interpretation as { summary?: string }).summary}
              </p>
            ) : (
              <Empty className="py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><SparklesIcon /></EmptyMedia>
                  <EmptyTitle>No interpretation yet</EmptyTitle>
                  <EmptyDescription>Generate an AI interpretation to summarize this report.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
              <input type="hidden" name="session_id" value={sessionId} />
              <input
                name="focus_dimension"
                placeholder="Focus dimension (optional)"
                className="rounded-lg border border-[#D2D2D7] px-2 py-1.5 text-[12px]"
              />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-full bg-[#0071E3] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
              >
                {isPending ? "Generating..." : "Generate Interpretation"}
              </button>
            </form>
          </div>
        </section>
      </TabsContent>

      {/* Output Tab */}
      <TabsContent value="output">
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
            {snapshot.session && (
              <div className="mt-4 grid grid-cols-2 gap-4 text-[12px] sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Session ID</p>
                  <p className="mt-0.5 font-mono text-[#1D1D1F]">{snapshot.session.id}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Status</p>
                  <p className="mt-0.5 text-[#1D1D1F]">{snapshot.session.status}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Candidate</p>
                  <p className="mt-0.5 font-mono text-[#1D1D1F]">{snapshot.session.candidate_id}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </TabsContent>

      {/* Integrity Tab */}
      <TabsContent value="integrity">
        <section className="space-y-6">
          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Event Timeline</h2>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#6E6E73]">Source</span>
                <Badge variant="outline" className="text-[11px]">
                  {snapshot.timeline_source}
                </Badge>
              </div>
            </div>
            {snapshot.timeline_warning ? (
              <div className="mb-4 rounded-lg border border-[#FF9F0A]/40 bg-[#FF9F0A]/10 px-3 py-2 text-[12px] text-[#A05A00]">
                {snapshot.timeline_warning}
              </div>
            ) : null}
            <div className="mb-4">
              <IntegrityTierSelect value={integrityTier} onChange={setIntegrityTier} />
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
      </TabsContent>

      {/* Provenance Tab */}
      <TabsContent value="provenance">
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
            <p className="mt-2 text-[13px] text-[#6E6E73]">
              Session <span className="font-mono">{sessionId}</span> — audit log entries will be linked here when the audit API is connected.
            </p>
          </div>
        </section>
      </TabsContent>
    </Tabs>
  )
}
