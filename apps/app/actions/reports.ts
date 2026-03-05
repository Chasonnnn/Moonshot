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
  error: string | null
}

export interface ReportActionState {
  ok: boolean
  message: string
  error: string | null
  requestId: string | null
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

    return {
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
      evaluation_bundle: fixture?.evaluationBundle ?? null,
      error: null,
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
      return { ok: false, message: "", error: "session_id is required", requestId: null }
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
        ok: false,
        message: "",
        error: `interpretation job failed: ${JSON.stringify(result.result)}`,
        requestId: null,
      }
    }
    const viewId = String(result.result["view_id"] ?? "")
    if (!viewId) {
      return { ok: false, message: "", error: "interpretation result missing view_id", requestId: null }
    }

    revalidatePath(`/reports/${sessionId}`)
    return { ok: true, message: `Interpretation generated: ${viewId}`, error: null, requestId: null }
  } catch (error) {
    const parsed = parseActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}

export async function updateHumanReviewAction(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  try {
    const sessionId = String(formData.get("session_id") ?? "").trim()
    if (!sessionId) {
      return { ok: false, message: "", error: "session_id is required", requestId: null }
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
      return { ok: false, message: "", error: "override_overall_score must be numeric", requestId: null }
    }
    if (overrideConfidence !== null && Number.isNaN(overrideConfidence)) {
      return { ok: false, message: "", error: "override_confidence must be numeric", requestId: null }
    }

    let dimensionOverrides: Record<string, number> | null = null
    if (dimensionOverridesRaw.length > 0) {
      const parsed = JSON.parse(dimensionOverridesRaw) as Record<string, unknown>
      dimensionOverrides = {}
      for (const [key, value] of Object.entries(parsed)) {
        const numeric = Number(value)
        if (Number.isNaN(numeric)) {
          return { ok: false, message: "", error: `dimension override for ${key} must be numeric`, requestId: null }
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
    return { ok: true, message: "Human review saved", error: null, requestId: null }
  } catch (error) {
    const parsed = parseActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}
