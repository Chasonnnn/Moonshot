import type { ReportDetailSnapshot } from "@/actions/reports"

export interface DimensionScore {
  dimension: string
  score: number
  note: string
}

export type Trend = "improving" | "declining" | "steady"
export type ConfidenceLevel = "high" | "medium" | "low"
export type HiringSuggestion = "strong-hire" | "lean-hire" | "lean-no" | "no-hire"

export interface TriggerSummary {
  count: number
  codes: string[]
}

export interface SmartSummary {
  strengths: DimensionScore[]
  weaknesses: DimensionScore[]
  trend: Trend
  confidenceLevel: ConfidenceLevel
  hiringSuggestion: HiringSuggestion
  triggerSummary: TriggerSummary
  overallScore: number
}

function extractDimensionScores(snapshot: ReportDetailSnapshot): DimensionScore[] {
  const scoreResult = snapshot.report?.score_result as Record<string, unknown> | undefined
  const dimEvidence = scoreResult?.dimension_evidence as Record<string, Record<string, unknown>> | undefined
  if (dimEvidence && Object.keys(dimEvidence).length > 0) {
    return Object.entries(dimEvidence).map(([key, value]) => ({
      dimension: key,
      score: Math.round(Number(value.score ?? 0) * 100),
      note: String(value.rationale ?? ""),
    }))
  }

  if (snapshot.evaluation_bundle?.coDesignAlignment && snapshot.evaluation_bundle.coDesignAlignment.length > 0) {
    return snapshot.evaluation_bundle.coDesignAlignment
  }

  return []
}

function computeTrend(rounds: Array<{ score: number }>): Trend {
  if (rounds.length <= 1) return "steady"

  const first = rounds[0].score
  const last = rounds[rounds.length - 1].score
  const delta = last - first

  if (Math.abs(delta) <= 10) return "steady"
  if (delta > 0) return "improving"
  return "declining"
}

function computeConfidenceLevel(finalConfidence: number | null): ConfidenceLevel {
  if (finalConfidence === null) return "medium"
  if (finalConfidence >= 0.75) return "high"
  if (finalConfidence >= 0.5) return "medium"
  return "low"
}

function computeHiringSuggestion(overallScore: number): HiringSuggestion {
  if (overallScore >= 80) return "strong-hire"
  if (overallScore >= 60) return "lean-hire"
  if (overallScore >= 40) return "lean-no"
  return "no-hire"
}

export type ScoreTier = "high" | "medium" | "low"

export function getScoreTier(score: number): ScoreTier {
  if (score >= 75) return "high"
  if (score >= 50) return "medium"
  return "low"
}

const TIER_COLORS: Record<ScoreTier, string> = {
  high: "#34C759",
  medium: "#FF9F0A",
  low: "#FF3B30",
}

export function getScoreColor(score: number): string {
  return TIER_COLORS[getScoreTier(score)]
}

export function computeSmartSummary(snapshot: ReportDetailSnapshot): SmartSummary {
  const dimensionScores = extractDimensionScores(snapshot)
  const sorted = [...dimensionScores].sort((a, b) => b.score - a.score)

  const strengths = sorted.slice(0, 3)
  const weaknessCount = Math.min(2, Math.max(0, dimensionScores.length - 3))
  const weaknesses = weaknessCount > 0 ? sorted.slice(-weaknessCount).reverse() : []

  const rounds = snapshot.evaluation_bundle?.roundPerformance ?? []
  const trend = computeTrend(rounds)

  const confidenceLevel = computeConfidenceLevel(snapshot.summary?.final_confidence ?? null)

  const triggerFromBundle = snapshot.evaluation_bundle?.triggerRationale ?? []
  const scoreResult = snapshot.report?.score_result as Record<string, unknown> | undefined
  const triggerCodesFromScore = Array.isArray(scoreResult?.trigger_codes)
    ? scoreResult.trigger_codes.map((code) => String(code))
    : []
  const triggerCodesFromSummary = snapshot.summary?.trigger_codes ?? []
  const triggerCodes =
    triggerFromBundle.length > 0
      ? triggerFromBundle.map((t) => t.code)
      : (triggerCodesFromScore.length > 0 ? triggerCodesFromScore : triggerCodesFromSummary)
  const triggerSummary: TriggerSummary = {
    count: triggerCodes.length,
    codes: triggerCodes,
  }

  const overallScore =
    dimensionScores.length > 0
      ? Math.round(dimensionScores.reduce((sum, d) => sum + d.score, 0) / dimensionScores.length)
      : 0

  const hiringSuggestion = computeHiringSuggestion(overallScore)

  return {
    strengths,
    weaknesses,
    trend,
    confidenceLevel,
    hiringSuggestion,
    triggerSummary,
    overallScore,
  }
}
