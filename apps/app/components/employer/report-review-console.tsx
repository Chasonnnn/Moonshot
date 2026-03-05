"use client"

import { useActionState, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { FileTextIcon, ShieldCheckIcon, ScaleIcon, CodeIcon, LinkIcon, BrainIcon } from "lucide-react"

import {
  INITIAL_REPORT_ACTION_STATE,
  updateHumanReviewAction,
  type ReportDetailSnapshot,
} from "@/actions/reports"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { OverallScoreGauge } from "@/components/employer/charts/overall-score-gauge"
import { DimensionRadar } from "@/components/employer/charts/dimension-radar"
import { RoundPerformanceLine } from "@/components/employer/charts/round-performance-line"
import { DimensionHeatmap } from "@/components/employer/charts/dimension-heatmap"
import { SmartSummaryCard } from "@/components/employer/smart-summary-card"
import { LlmAnalysisPanel } from "@/components/employer/llm-analysis-panel"
import { EventTimeline } from "@/components/employer/event-timeline"
import { IntegrityTierSelect } from "@/components/employer/integrity-tier-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { IntegrityTier } from "@/lib/integrity-tiers"
import { getScoringLabel } from "@/lib/scoring-labels"
import type { SessionMode } from "@/lib/moonshot/types"

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

export function ReportReviewConsole({ sessionId, snapshot }: { sessionId: string; snapshot: ReportDetailSnapshot }) {
  const [humanState, humanFormAction, isHumanPending] = useActionState(updateHumanReviewAction, INITIAL_REPORT_ACTION_STATE)
  const [integrityTier, setIntegrityTier] = useState<IntegrityTier>("standard")
  useActionStateToast(humanState)

  const scoringLabel = getScoringLabel(toSessionMode(snapshot.session?.policy?.coach_mode))
  const sessionStartedAt = snapshot.session?.created_at ?? new Date().toISOString()

  const scoreResult = useMemo(
    () => asRecord(asRecord(snapshot.report)?.score_result),
    [snapshot.report],
  )
  const dimensionEvidence = useMemo(
    () => asRecord(scoreResult?.dimension_evidence),
    [scoreResult],
  )

  const smartSummary = snapshot.computed_analysis ?? {
    strengths: [],
    weaknesses: [],
    trend: "steady" as const,
    confidenceLevel: "medium" as const,
    hiringSuggestion: "lean-no" as const,
    triggerSummary: { count: 0, codes: [] },
    overallScore: 0,
  }
  const displayOverallScore =
    snapshot.summary?.final_score_source === "human_override" &&
    typeof snapshot.human_review?.override_overall_score === "number"
      ? Math.round(snapshot.human_review.override_overall_score * 100)
      : smartSummary.overallScore

  if (snapshot.error) {
    return (
      <section className="rounded-2xl border border-[#FF9F0A] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Report View Unavailable</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">{snapshot.error}</p>
      </section>
    )
  }

  const toolChartData = snapshot.evaluation_bundle?.toolProficiency ?? []

  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-4 w-fit">
        <TabsTrigger value="overview" className="text-[12px]">Overview</TabsTrigger>
        <TabsTrigger value="output" className="text-[12px]">Output</TabsTrigger>
        <TabsTrigger value="integrity" className="text-[12px]">Integrity</TabsTrigger>
        <TabsTrigger value="provenance" className="text-[12px]">Provenance</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <section className="space-y-6">
          {/* 1. Report Summary */}
          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-5 text-[#6E6E73]" />
              <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Report Summary</h2>
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
                <p className="mt-0.5 font-mono text-[12px] text-[#1D1D1F]">{snapshot.demo_template_id ?? "n/a"}</p>
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

          {/* 2. Overall Score Gauge + Smart Summary — side by side */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-[18px] font-semibold text-[#1D1D1F]">Overall Score</h2>
              <OverallScoreGauge
                score={displayOverallScore}
                confidence={snapshot.summary?.final_confidence ?? null}
              />
            </div>
            <SmartSummaryCard summary={smartSummary} />
          </div>

          {/* 3. Dimension Radar + Dimension Heatmap — side by side */}
          {snapshot.evaluation_bundle && snapshot.evaluation_bundle.coDesignAlignment.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-[18px] font-semibold text-[#1D1D1F]">Dimension Radar</h2>
                <DimensionRadar dimensions={snapshot.evaluation_bundle.coDesignAlignment} />
              </div>
              <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-[18px] font-semibold text-[#1D1D1F]">Dimension Scores</h2>
                <DimensionHeatmap dimensions={snapshot.evaluation_bundle.coDesignAlignment} />
              </div>
            </div>
          )}

          {/* 4. Round Performance Line Chart — full width */}
          {snapshot.evaluation_bundle && snapshot.evaluation_bundle.roundPerformance.length > 0 && (
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-[18px] font-semibold text-[#1D1D1F]">Round-by-Round Performance</h2>
              <RoundPerformanceLine rounds={snapshot.evaluation_bundle.roundPerformance} />
            </div>
          )}

          {/* 5. Tool Proficiency BarChart */}
          {toolChartData.length > 0 && (
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-[18px] font-semibold text-[#1D1D1F]">Tool Proficiency</h2>
              <ChartContainer
                className="h-[260px] w-full"
                config={{
                  score: { label: "Score", color: "#0071E3" },
                }}
              >
                <BarChart data={toolChartData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="tool" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="score" fill="var(--color-score)" radius={6} />
                </BarChart>
              </ChartContainer>
            </div>
          )}

          {/* 6. Co-Design Alignment Scorecard */}
          {snapshot.evaluation_bundle && (
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BrainIcon className="size-5 text-[#6E6E73]" />
                <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Co-Design Alignment Scorecard</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {snapshot.evaluation_bundle.coDesignAlignment.map((item) => (
                  <div key={item.dimension} className="rounded-lg border border-[#E5E5EA] bg-[#FAFAFB] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-[#1D1D1F]">{item.dimension}</p>
                      <Badge variant="outline" className="text-[11px]">{item.score}/100</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-[#6E6E73]">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. LLM Analysis Panel (replaces old Interpretation section) */}
          <LlmAnalysisPanel sessionId={sessionId} snapshot={snapshot} />

          {/* 8. Human Notes & Override */}
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
        </section>
      </TabsContent>

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
          </div>

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
      </TabsContent>

      <TabsContent value="integrity">
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
