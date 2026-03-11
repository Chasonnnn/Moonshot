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

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="ops-surface p-6">
          <h2 className="mb-3 text-[18px] font-semibold text-[var(--ops-text)]">Overall Score</h2>
          <OverallScoreGauge
            score={displayOverallScore}
            confidence={snapshot.summary?.final_confidence ?? null}
          />
        </div>
        <SmartSummaryCard summary={smartSummary} />
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

      {snapshot.evaluation_bundle && snapshot.evaluation_bundle.roundPerformance.length > 0 && (
        <div className="ops-surface p-6">
          <h2 className="mb-3 text-[18px] font-semibold text-[var(--ops-text)]">Round-by-Round Performance</h2>
          <RoundPerformanceLine rounds={snapshot.evaluation_bundle.roundPerformance} />
        </div>
      )}

      {toolChartData.length > 0 && (
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
