"use client"

import { useActionState } from "react"
import { SparklesIcon } from "lucide-react"
import {
  createInterpretationAction,
  type ReportDetailSnapshot,
} from "@/actions/reports"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import type { InterpretationView } from "@/lib/moonshot/types"
import { INITIAL_REPORT_ACTION_STATE } from "@/lib/report-action-state"

type ReportInterpretation = {
  summary?: string
  suggestions?: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

function formatDimensionValue(value: unknown): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return "n/a"
  return numeric <= 1 ? `${Math.round(numeric * 100)}%` : `${Math.round(numeric)}`
}

function buildInterpretationSummary(value: InterpretationView | ReportInterpretation | null): string | null {
  if (!value) return null

  if (typeof (value as ReportInterpretation).summary === "string") {
    const summary = (value as ReportInterpretation).summary?.trim()
    if (summary) return summary
  }

  const breakdown = asRecord((value as InterpretationView).breakdown)
  const dimensionScores = asRecord(breakdown?.dimension_scores)
  if (dimensionScores && Object.keys(dimensionScores).length > 0) {
    const topDimensions = Object.entries(dimensionScores)
      .map(([key, score]) => `${key}: ${formatDimensionValue(score)}`)
      .slice(0, 3)
      .join(", ")
    return `Top dimensions from generated interpretation: ${topDimensions}`
  }

  const focusDimensions = Array.isArray((value as InterpretationView).focus_dimensions)
    ? (value as InterpretationView).focus_dimensions.filter((item) => typeof item === "string")
    : []
  if (focusDimensions.length > 0) {
    return `Generated interpretation focused on: ${focusDimensions.join(", ")}`
  }

  return null
}

function toSortedEntries(value: Record<string, unknown> | null): Array<[string, unknown]> {
  if (!value) return []
  return Object.entries(value).sort((a, b) => a[0].localeCompare(b[0]))
}

export function LlmAnalysisPanel({ sessionId, snapshot }: { sessionId: string; snapshot: ReportDetailSnapshot }) {
  const [state, formAction, isPending] = useActionState(createInterpretationAction, INITIAL_REPORT_ACTION_STATE)
  useActionStateToast(state)

  const interpretationView: InterpretationView | null = state.interpretation ?? snapshot.interpretation ?? null
  const interpretation: InterpretationView | ReportInterpretation | null =
    interpretationView ??
    (snapshot.report?.interpretation as ReportInterpretation | null | undefined) ??
    null
  const interpretationSummary = buildInterpretationSummary(interpretation)
  const breakdown = asRecord(interpretationView?.breakdown)
  const dimensionScores = asRecord(breakdown?.dimension_scores)
  const objectiveMetrics = asRecord(breakdown?.objective_metrics)
  const sensitivity = asRecord(breakdown?.sensitivity_analysis)
  const weightedDimensions = asRecord(sensitivity?.weighted_dimensions)
  const caveats = Array.isArray(interpretationView?.caveats)
    ? interpretationView.caveats.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []

  return (
    <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <SparklesIcon className="size-5 text-[#6E6E73]" />
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">AI Analysis</h2>
      </div>

      {interpretationSummary ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-[#F5F5F7] p-4">
            <p className="text-[13px] leading-relaxed text-[#1D1D1F]">{interpretationSummary}</p>
          </div>
          {interpretationView ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-[#E5E5EA] bg-[#FAFAFB] p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">View ID</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-[#1D1D1F]">{interpretationView.view_id}</p>
                </div>
                <div className="rounded-lg border border-[#E5E5EA] bg-[#FAFAFB] p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Focus Dimensions</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {interpretationView.focus_dimensions.length > 0 ? (
                      interpretationView.focus_dimensions.map((dimension) => (
                        <span
                          key={dimension}
                          className="rounded-md border border-[#D2D2D7] bg-white px-2 py-0.5 text-[11px] text-[#1D1D1F]"
                        >
                          {dimension}
                        </span>
                      ))
                    ) : (
                      <span className="text-[12px] text-[#6E6E73]">All scored dimensions</span>
                    )}
                  </div>
                </div>
              </div>

              {toSortedEntries(dimensionScores).length > 0 && (
                <div className="rounded-lg border border-[#E5E5EA] bg-white p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Dimension Scores</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {toSortedEntries(dimensionScores).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between rounded-md bg-[#F5F5F7] px-2 py-1">
                        <span className="font-mono text-[11px] text-[#1D1D1F]">{key}</span>
                        <span className="text-[11px] text-[#1D1D1F]">{formatDimensionValue(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {toSortedEntries(objectiveMetrics).length > 0 && (
                <div className="rounded-lg border border-[#E5E5EA] bg-white p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Objective Metrics</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {toSortedEntries(objectiveMetrics).map(([key, value]) => (
                      <div key={key} className="rounded-md bg-[#F5F5F7] px-2 py-1">
                        <p className="font-mono text-[11px] text-[#1D1D1F]">{key}</p>
                        <p className="mt-0.5 text-[11px] text-[#6E6E73]">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(toSortedEntries(weightedDimensions).length > 0 || typeof sensitivity?.note === "string") && (
                <div className="rounded-lg border border-[#E5E5EA] bg-white p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Sensitivity Analysis</p>
                  {typeof sensitivity?.note === "string" && (
                    <p className="mt-1 text-[12px] text-[#6E6E73]">{sensitivity.note}</p>
                  )}
                  {toSortedEntries(weightedDimensions).length > 0 && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {toSortedEntries(weightedDimensions).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-md bg-[#F5F5F7] px-2 py-1">
                          <span className="font-mono text-[11px] text-[#1D1D1F]">{key}</span>
                          <span className="text-[11px] text-[#1D1D1F]">{formatDimensionValue(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {caveats.length > 0 && (
                <div className="rounded-lg border border-[#E5E5EA] bg-white p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Caveats</p>
                  <ul className="mt-2 space-y-1">
                    {caveats.map((caveat) => (
                      <li key={caveat} className="text-[12px] text-[#6E6E73]">
                        {caveat}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SparklesIcon /></EmptyMedia>
            <EmptyTitle>No AI analysis yet</EmptyTitle>
            <EmptyDescription>Generate a deep analysis to get structured insights about this candidate.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="session_id" value={sessionId} />
        <Input
          name="focus_dimension"
          placeholder="Focus dimension (optional)"
          className="h-8 max-w-[240px] rounded-lg text-[12px]"
        />
        <Button type="submit" disabled={isPending} size="sm" className="text-[12px]">
          {isPending ? "Generating..." : "Generate Deep Analysis"}
        </Button>
      </form>
    </div>
  )
}
