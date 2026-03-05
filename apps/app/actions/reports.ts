"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import {
  MoonshotApiError,
  type FairnessSmokeRun,
  type HumanReviewRecord,
  type InterpretationView,
  type RedTeamRun,
  type ReportSummary,
  type SessionEvent,
  type SessionRecord,
} from "@/lib/moonshot/types"
import { getMockSessionEvents } from "@/lib/mock-events"
import { DEMO_FIXTURES, type DemoCoDesignBundle, type DemoEvaluationBundle, type DemoRound } from "@/lib/moonshot/demo-fixtures"
import { computeSmartSummary, type SmartSummary } from "@/lib/report-analysis"

export interface ReportDetailSnapshot {
  session: SessionRecord | null
  summary: ReportSummary | null
  report: Record<string, unknown> | null
  redteamRuns: RedTeamRun[]
  fairnessRuns: FairnessSmokeRun[]
  events: SessionEvent[]
  timeline_source: "real" | "fixture"
  timeline_warning: string | null
  interpretation: InterpretationView | null
  human_review: HumanReviewRecord | null
  demo_template_id: string | null
  co_design_bundle: DemoCoDesignBundle | null
  round_blueprint: DemoRound[]
  evaluation_bundle: DemoEvaluationBundle | null
  computed_analysis: SmartSummary | null
  error: string | null
}

export interface ReportActionState {
  ok: boolean
  message: string
  error: string | null
  requestId: string | null
  interpretation: InterpretationView | null
}

export const INITIAL_REPORT_ACTION_STATE: ReportActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
  interpretation: null,
}

function parseActionError(error: unknown): { error: string; requestId: string | null } {
  if (error instanceof MoonshotApiError) {
    return { error: `${error.errorCode}: ${error.errorDetail}`, requestId: error.requestId }
  }
  if (error instanceof Error) {
    return { error: error.message, requestId: null }
  }
  return { error: "Unknown error", requestId: null }
}

function fixtureTimelineEnabled(): boolean {
  return String(process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE ?? "").toLowerCase() === "true"
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

function clampPercent(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const normalized = numeric <= 1 ? numeric * 100 : numeric
  return Math.min(100, Math.max(0, Math.round(normalized)))
}

function toTitleCaseKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function deriveEvaluationBundleFromReport(report: Record<string, unknown> | null): DemoEvaluationBundle | null {
  const scoreResult = asRecord(report?.score_result)
  if (!scoreResult) return null

  const dimensionEvidence = asRecord(scoreResult.dimension_evidence)
  if (!dimensionEvidence || Object.keys(dimensionEvidence).length === 0) {
    return null
  }

  const coDesignAlignment = Object.entries(dimensionEvidence).map(([rawDimension, rawValue]) => {
    const value = asRecord(rawValue)
    return {
      dimension: toTitleCaseKey(rawDimension),
      score: clampPercent(value?.score),
      note: String(value?.rationale ?? "No rationale provided."),
    }
  })

  const triggerCodes = Array.isArray(scoreResult.trigger_codes)
    ? scoreResult.trigger_codes.map((code) => String(code)).filter(Boolean)
    : []
  const triggerImpacts = Array.isArray(scoreResult.trigger_impacts)
    ? scoreResult.trigger_impacts
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
    : []
  const impactByCode = new Map(
    triggerImpacts
      .map((item) => [String(item.code ?? ""), Number(item.delta ?? 0)] as const)
      .filter(([code]) => code.length > 0),
  )
  const triggerRationale = triggerCodes.map((code) => {
    const delta = impactByCode.get(code)
    const hasDelta = delta !== undefined && Number.isFinite(delta)
    return {
      code,
      rationale: hasDelta ? `Model impact delta ${delta.toFixed(3)}` : "Auto-detected scoring trigger",
      impact: hasDelta && delta < 0 ? "negative" : "neutral",
    }
  })

  const reportInterpretation = asRecord(report?.interpretation)
  const narrativeSummary =
    typeof reportInterpretation?.summary === "string" && reportInterpretation.summary.trim().length > 0
      ? reportInterpretation.summary.trim()
      : null

  return {
    coDesignAlignment,
    roundPerformance: [],
    toolProficiency: [],
    triggerRationale,
    agentNarrative: narrativeSummary ? [narrativeSummary] : [],
  }
}

export async function loadReportDetailSnapshot(sessionId: string): Promise<ReportDetailSnapshot> {
  try {
    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)

    const session = await client.getSession(reviewer.access_token, sessionId)
    const demoTemplateId = typeof session.policy?.demo_template_id === "string" ? session.policy.demo_template_id : null
    const fixture = demoTemplateId ? DEMO_FIXTURES[demoTemplateId] ?? null : null
    const [summary, redteamRuns, fairnessRuns, humanReview] = await Promise.all([
      client.getReportSummary(reviewer.access_token, sessionId),
      client.listRedteamRuns(reviewer.access_token, { targetType: "session", targetId: sessionId, limit: 5 }),
      client.listFairnessSmokeRuns(reviewer.access_token, { targetSessionId: sessionId, limit: 5 }),
      client.getHumanReview(reviewer.access_token, sessionId),
    ])
    let report: Record<string, unknown> | null = null
    if (summary.report_available) {
      report = await client.getReport(reviewer.access_token, sessionId)
    }
    const derivedEvaluationBundle = deriveEvaluationBundleFromReport(report)

    let events: SessionEvent[] = []
    let timelineSource: "real" | "fixture" = "real"
    let timelineWarning: string | null = null
    try {
      const eventsPage = await client.listSessionEvents(reviewer.access_token, sessionId, { limit: 250 })
      events = eventsPage.items.map((item) => ({
        event_type: item.event_type,
        payload: item.payload,
        timestamp: item.timestamp,
      }))
    } catch (eventError) {
      if (!fixtureTimelineEnabled()) {
        throw eventError
      }
      const parsed = parseActionError(eventError)
      timelineSource = "fixture"
      timelineWarning = `Using fixture timeline because real event retrieval failed: ${parsed.error} (request_id=${parsed.requestId ?? "n/a"})`
      events = getMockSessionEvents(sessionId)
    }

    const partial: Omit<ReportDetailSnapshot, "computed_analysis"> = {
      session,
      summary,
      report,
      redteamRuns: redteamRuns.items,
      fairnessRuns: fairnessRuns.items,
      events,
      timeline_source: timelineSource,
      timeline_warning: timelineWarning,
      interpretation: null,
      human_review: humanReview,
      demo_template_id: demoTemplateId,
      co_design_bundle: fixture?.coDesignBundle ?? null,
      round_blueprint: fixture?.rounds ?? [],
      evaluation_bundle: derivedEvaluationBundle ?? fixture?.evaluationBundle ?? null,
      error: null,
    }
    return {
      ...partial,
      computed_analysis: computeSmartSummary(partial as ReportDetailSnapshot),
    }
  } catch (error) {
    const parsed = parseActionError(error)
    return {
      session: null,
      summary: null,
      report: null,
      redteamRuns: [],
      fairnessRuns: [],
      events: [],
      timeline_source: "real",
      timeline_warning: null,
      interpretation: null,
      human_review: null,
      demo_template_id: null,
      co_design_bundle: null,
      round_blueprint: [],
      evaluation_bundle: null,
      computed_analysis: null,
      error: `${parsed.error} (request_id=${parsed.requestId ?? "n/a"})`,
    }
  }
}

export async function createInterpretationAction(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  try {
    const sessionId = String(formData.get("session_id") ?? "").trim()
    if (!sessionId) {
      return { ...INITIAL_REPORT_ACTION_STATE, error: "session_id is required" }
    }
    const focusDimension = String(formData.get("focus_dimension") ?? "").trim()

    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)
    const accepted = await client.createInterpretation(
      reviewer.access_token,
      sessionId,
      {
        focus_dimensions: focusDimension ? [focusDimension] : [],
        include_sensitivity: true,
      },
      `interpret-${randomUUID()}`,
    )
    const result = await client.waitForJobTerminalResult(reviewer.access_token, accepted.job_id, {
      timeoutMs: 30_000,
      initialIntervalMs: 500,
      maxIntervalMs: 2_000,
    })
    if (result.status !== "completed") {
      return {
        ...INITIAL_REPORT_ACTION_STATE,
        error: `interpretation job failed: ${JSON.stringify(result.result)}`,
      }
    }
    const viewId = String(result.result["view_id"] ?? "")
    if (!viewId) {
      return { ...INITIAL_REPORT_ACTION_STATE, error: "interpretation result missing view_id" }
    }
    const interpretation = await client.getInterpretation(reviewer.access_token, sessionId, viewId)

    revalidatePath(`/reports/${sessionId}`)
    return {
      ok: true,
      message: `Interpretation generated: ${viewId}`,
      error: null,
      requestId: null,
      interpretation,
    }
  } catch (error) {
    const parsed = parseActionError(error)
    return { ...INITIAL_REPORT_ACTION_STATE, error: parsed.error, requestId: parsed.requestId }
  }
}

export async function updateHumanReviewAction(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  try {
    const sessionId = String(formData.get("session_id") ?? "").trim()
    if (!sessionId) {
      return { ...INITIAL_REPORT_ACTION_STATE, error: "session_id is required" }
    }

    const notes = String(formData.get("notes_markdown") ?? "").trim()
    const tagsRaw = String(formData.get("tags_csv") ?? "").trim()
    const overrideScoreRaw = String(formData.get("override_overall_score") ?? "").trim()
    const overrideConfidenceRaw = String(formData.get("override_confidence") ?? "").trim()
    const dimensionOverridesRaw = String(formData.get("dimension_overrides_json") ?? "").trim()

    const tags = tagsRaw
      ? tagsRaw.split(",").map((item) => item.trim()).filter(Boolean)
      : []

    const overrideOverallScore =
      overrideScoreRaw.length > 0 ? Number.parseFloat(overrideScoreRaw) : null
    const overrideConfidence =
      overrideConfidenceRaw.length > 0 ? Number.parseFloat(overrideConfidenceRaw) : null

    if (overrideOverallScore !== null && Number.isNaN(overrideOverallScore)) {
      return { ...INITIAL_REPORT_ACTION_STATE, error: "override_overall_score must be numeric" }
    }
    if (overrideConfidence !== null && Number.isNaN(overrideConfidence)) {
      return { ...INITIAL_REPORT_ACTION_STATE, error: "override_confidence must be numeric" }
    }
    if (overrideOverallScore !== null && (overrideOverallScore < 0 || overrideOverallScore > 1)) {
      return { ...INITIAL_REPORT_ACTION_STATE, error: "override_overall_score must be between 0 and 1" }
    }
    if (overrideConfidence !== null && (overrideConfidence < 0 || overrideConfidence > 1)) {
      return { ...INITIAL_REPORT_ACTION_STATE, error: "override_confidence must be between 0 and 1" }
    }

    let dimensionOverrides: Record<string, number> | null = null
    if (dimensionOverridesRaw.length > 0) {
      const parsed = JSON.parse(dimensionOverridesRaw) as Record<string, unknown>
      dimensionOverrides = {}
      for (const [key, value] of Object.entries(parsed)) {
        const numeric = Number(value)
        if (Number.isNaN(numeric)) {
          return { ...INITIAL_REPORT_ACTION_STATE, error: `dimension override for ${key} must be numeric` }
        }
        dimensionOverrides[key] = numeric
      }
    }

    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)
    await client.updateHumanReview(reviewer.access_token, sessionId, {
      notes_markdown: notes.length > 0 ? notes : null,
      tags,
      override_overall_score: overrideOverallScore,
      override_confidence: overrideConfidence,
      dimension_overrides: dimensionOverrides,
    })

    revalidatePath(`/reports/${sessionId}`)
    return { ...INITIAL_REPORT_ACTION_STATE, ok: true, message: "Human review saved" }
  } catch (error) {
    const parsed = parseActionError(error)
    return { ...INITIAL_REPORT_ACTION_STATE, error: parsed.error, requestId: parsed.requestId }
  }
}
