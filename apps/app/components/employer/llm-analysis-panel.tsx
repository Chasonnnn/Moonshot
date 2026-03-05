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

export function LlmAnalysisPanel({ sessionId, snapshot }: { sessionId: string; snapshot: ReportDetailSnapshot }) {
  const [state, formAction, isPending] = useActionState(createInterpretationAction, INITIAL_REPORT_ACTION_STATE)
  useActionStateToast(state)

  const interpretation: InterpretationView | ReportInterpretation | null =
    state.interpretation ??
    snapshot.interpretation ??
    (snapshot.report?.interpretation as ReportInterpretation | null | undefined) ??
    null
  const interpretationSummary = buildInterpretationSummary(interpretation)

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
