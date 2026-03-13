"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { BrainIcon } from "lucide-react"

import type { ReportDetailSnapshot } from "@/actions/reports"
import { OverallScoreGauge } from "@/components/employer/charts/overall-score-gauge"
import { DimensionRadar } from "@/components/employer/charts/dimension-radar"
import { RoundPerformanceLine } from "@/components/employer/charts/round-performance-line"
import { DimensionHeatmap } from "@/components/employer/charts/dimension-heatmap"
import { LlmAnalysisPanel } from "@/components/employer/llm-analysis-panel"
import { SmartSummaryCard } from "@/components/employer/smart-summary-card"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { getRoundToolActions } from "@/lib/moonshot/demo-fixtures"

type ReportSmartSummary = NonNullable<ReportDetailSnapshot["computed_analysis"]>

export function ReportOverviewAnalytics({
  sessionId,
  snapshot,
  displayOverallScore,
  smartSummary,
}: {
  sessionId: string
  snapshot: ReportDetailSnapshot
  displayOverallScore: number
  smartSummary: ReportSmartSummary
}) {
  const toolChartData = snapshot.evaluation_bundle?.toolProficiency ?? []
  const artifactCount = new Set(
    snapshot.round_blueprint.flatMap((round) => [
      ...round.mockedArtifacts,
      ...getRoundToolActions(round).flatMap((action) => action.artifactRefs ?? []),
    ]),
  ).size
  const supervisorLogCount = snapshot.round_blueprint.reduce((count, round) => count + round.coachScript.length, 0)
  const aiTraceCount = snapshot.events.filter((event) =>
    ["copilot_invoked", "copilot_output_accepted", "copilot_output_edited"].includes(event.event_type),
  ).length
  const pivotEvidenceCount = snapshot.events.filter((event) =>
    ["checkpoint_saved", "deliverable_draft_saved", "coach_message"].includes(event.event_type),
  ).length

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <SmartSummaryCard summary={smartSummary} />
        <div className="ops-surface p-6">
          <h2 className="mb-3 text-[18px] font-semibold text-[var(--ops-text)]">Sponsor Evidence Summary</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Artifacts", value: String(artifactCount) },
              { label: "Supervisor / coach turns", value: String(supervisorLogCount) },
              { label: "AI trace events", value: String(aiTraceCount) },
              { label: "Checkpoint evidence", value: String(pivotEvidenceCount) },
            ].map((item) => (
              <div key={item.label} className="ops-surface-soft rounded-2xl p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">{item.label}</p>
                <p className="mt-2 text-[22px] font-semibold text-[var(--ops-text)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {snapshot.evaluation_bundle && snapshot.evaluation_bundle.coDesignAlignment.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="ops-surface p-6">
            <h2 className="mb-3 text-[18px] font-semibold text-[var(--ops-text)]">Dimension Radar</h2>
            <DimensionRadar dimensions={snapshot.evaluation_bundle.coDesignAlignment} />
          </div>
          <div className="ops-surface p-6">
            <h2 className="mb-3 text-[18px] font-semibold text-[var(--ops-text)]">Dimension Scores</h2>
            <DimensionHeatmap dimensions={snapshot.evaluation_bundle.coDesignAlignment} />
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="ops-surface p-6">
          <h2 className="mb-3 text-[18px] font-semibold text-[var(--ops-text)]">Overall Score Benchmark</h2>
          <OverallScoreGauge
            score={displayOverallScore}
            confidence={snapshot.summary?.final_confidence ?? null}
          />
        </div>

        {toolChartData.length > 0 ? (
          <div className="ops-surface p-6">
            <h2 className="mb-3 text-[18px] font-semibold text-[var(--ops-text)]">Tool Proficiency</h2>
            <ChartContainer
              className="h-[260px] w-full"
              config={{
                score: { label: "Score", color: "var(--ops-accent)" },
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
        ) : null}
      </div>

      {snapshot.evaluation_bundle && snapshot.evaluation_bundle.roundPerformance.length > 0 && (
        <div className="ops-surface p-6">
          <h2 className="mb-3 text-[18px] font-semibold text-[var(--ops-text)]">Round-by-Round Performance</h2>
          <RoundPerformanceLine rounds={snapshot.evaluation_bundle.roundPerformance} />
        </div>
      )}

      {snapshot.evaluation_bundle && (
        <div className="ops-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <BrainIcon className="size-5 text-[var(--ops-text-subtle)]" />
            <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Co-Design Alignment Scorecard</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.evaluation_bundle.coDesignAlignment.map((item) => (
              <div key={item.dimension} className="ops-surface-soft rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[var(--ops-text)]">{item.dimension}</p>
                  <Badge variant="outline" className="text-[11px]">{item.score}/100</Badge>
                </div>
                <p className="mt-1 text-[12px] text-[var(--ops-text-subtle)]">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <LlmAnalysisPanel sessionId={sessionId} snapshot={snapshot} />
    </>
  )
}
