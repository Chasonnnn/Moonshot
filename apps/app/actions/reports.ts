"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import {
  MoonshotApiError,
  type FairnessSmokeRun,
  type InterpretationView,
  type RedTeamRun,
  type ReportSummary,
  type SessionRecord,
} from "@/lib/moonshot/types"

export interface ReportDetailSnapshot {
  session: SessionRecord | null
  summary: ReportSummary | null
  report: Record<string, unknown> | null
  redteamRuns: RedTeamRun[]
  fairnessRuns: FairnessSmokeRun[]
  interpretation: InterpretationView | null
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

export async function loadReportDetailSnapshot(sessionId: string): Promise<ReportDetailSnapshot> {
  try {
    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)

    const session = await client.getSession(reviewer.access_token, sessionId)
    const [summary, redteamRuns, fairnessRuns] = await Promise.all([
      client.getReportSummary(reviewer.access_token, sessionId),
      client.listRedteamRuns(reviewer.access_token, { targetType: "session", targetId: sessionId, limit: 5 }),
      client.listFairnessSmokeRuns(reviewer.access_token, { targetSessionId: sessionId, limit: 5 }),
    ])
    let report: Record<string, unknown> | null = null
    if (summary.report_available) {
      report = await client.getReport(reviewer.access_token, sessionId)
    }

    return {
      session,
      summary,
      report,
      redteamRuns: redteamRuns.items,
      fairnessRuns: fairnessRuns.items,
      interpretation: null,
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
      interpretation: null,
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
