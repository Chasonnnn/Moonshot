import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MoonshotApiError } from "@/lib/moonshot/types"

const { mockCreateMoonshotClientFromEnv, mockGetMockSessionEvents } = vi.hoisted(() => ({
  mockCreateMoonshotClientFromEnv: vi.fn(),
  mockGetMockSessionEvents: vi.fn(),
}))

vi.mock("@/lib/moonshot/client", () => ({
  createMoonshotClientFromEnv: mockCreateMoonshotClientFromEnv,
}))

vi.mock("@/lib/mock-events", () => ({
  getMockSessionEvents: mockGetMockSessionEvents,
}))

import { loadReportDetailSnapshot, updateHumanReviewAction } from "@/actions/reports"
import { INITIAL_REPORT_ACTION_STATE } from "@/lib/report-action-state"

function buildClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    config: { reviewerUserId: "reviewer_1", adminUserId: "admin_1" },
    issueToken: vi.fn().mockResolvedValue({ access_token: "reviewer-token" }),
    getSession: vi.fn().mockResolvedValue({
      id: "sess-1",
      tenant_id: "tenant_a",
      task_family_id: "tf-1",
      candidate_id: "candidate_1",
      status: "submitted",
      policy: { coach_mode: "assessment" },
      final_response: "done",
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-01T10:10:00Z",
    }),
    getReportSummary: vi.fn().mockResolvedValue({
      session_id: "sess-1",
      session_status: "submitted",
      report_available: false,
      confidence: null,
      needs_human_review: null,
      trigger_codes: [],
      trigger_count: 0,
      last_scored_at: null,
      scoring_version_lock: null,
      has_human_review: false,
      final_score_source: null,
      final_confidence: null,
    }),
    getHumanReview: vi.fn().mockResolvedValue({
      session_id: "sess-1",
      tenant_id: "tenant_a",
      notes_markdown: null,
      tags: [],
      override_overall_score: null,
      override_confidence: null,
      dimension_overrides: {},
      reviewer_id: null,
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-01T10:00:00Z",
    }),
    listRedteamRuns: vi.fn().mockResolvedValue({ items: [] }),
    listFairnessSmokeRuns: vi.fn().mockResolvedValue({ items: [] }),
    getContextInjectionTraces: vi.fn().mockResolvedValue({
      items: [
        {
          agent_type: "coach",
          context_keys: ["case_scenario", "policy_constraints", "coach_policy"],
        },
        {
          agent_type: "evaluator",
          context_keys: ["task_rubric", "score_result"],
        },
      ],
    }),
    getAuditChainVerification: vi.fn().mockResolvedValue({
      valid: true,
      checked_entries: 8,
      error_code: null,
      error_detail: null,
    }),
    listAuditLogs: vi.fn().mockResolvedValue({
      items: [
        { resource_id: "sess-1" },
        { resource_id: "sess-1" },
        { resource_id: "other-session" },
      ],
    }),
    listSessionEvents: vi.fn().mockResolvedValue({
      items: [{ event_type: "session_started", payload: {}, timestamp: "2026-03-01T10:00:00Z" }],
      next_cursor: null,
      limit: 250,
      total: 1,
    }),
    ...overrides,
  }
}

describe("loadReportDetailSnapshot timeline source behavior", () => {
  const originalEnv = process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE

  beforeEach(() => {
    mockCreateMoonshotClientFromEnv.mockReset()
    mockGetMockSessionEvents.mockReset()
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE
    } else {
      process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE = originalEnv
    }
  })

  it("uses real timeline when event retrieval succeeds", async () => {
    process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE = "false"
    mockCreateMoonshotClientFromEnv.mockReturnValue(buildClient())

    const snapshot = await loadReportDetailSnapshot("sess-1")

    expect(snapshot.error).toBeNull()
    expect(snapshot.timeline_source).toBe("real")
    expect(snapshot.timeline_warning).toBeNull()
    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.events[0].event_type).toBe("session_started")
    expect(mockGetMockSessionEvents).not.toHaveBeenCalled()
  })

  it("uses fixture timeline with explicit warning when enabled", async () => {
    process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE = "true"
    const apiError = new MoonshotApiError("not_found: Session not found", {
      status: 404,
      errorCode: "not_found",
      errorDetail: "Session not found",
      requestId: "req-123",
    })
    mockCreateMoonshotClientFromEnv.mockReturnValue(
      buildClient({
        listSessionEvents: vi.fn().mockRejectedValue(apiError),
      }),
    )
    mockGetMockSessionEvents.mockReturnValue([
      { event_type: "fixture_event", payload: { source: "fixture" }, timestamp: "2026-03-01T11:00:00Z" },
    ])

    const snapshot = await loadReportDetailSnapshot("sess-1")

    expect(snapshot.error).toBeNull()
    expect(snapshot.timeline_source).toBe("fixture")
    expect(snapshot.timeline_warning).toContain("request_id=req-123")
    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.events[0].event_type).toBe("fixture_event")
    expect(mockGetMockSessionEvents).toHaveBeenCalledWith("sess-1")
  })

  it("returns explicit error when real timeline fails and fixture mode is disabled", async () => {
    process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE = "false"
    const apiError = new MoonshotApiError("forbidden: denied", {
      status: 403,
      errorCode: "forbidden",
      errorDetail: "denied",
      requestId: "req-999",
    })
    mockCreateMoonshotClientFromEnv.mockReturnValue(
      buildClient({
        listSessionEvents: vi.fn().mockRejectedValue(apiError),
      }),
    )

    const snapshot = await loadReportDetailSnapshot("sess-1")

    expect(snapshot.error).toContain("forbidden: denied")
    expect(snapshot.error).toContain("request_id=req-999")
    expect(snapshot.timeline_source).toBe("real")
    expect(snapshot.timeline_warning).toBeNull()
    expect(snapshot.events).toHaveLength(0)
    expect(mockGetMockSessionEvents).not.toHaveBeenCalled()
  })

  it("derives evaluation bundle from report dimension evidence when available", async () => {
    process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE = "false"
    mockCreateMoonshotClientFromEnv.mockReturnValue(
      buildClient({
        getReportSummary: vi.fn().mockResolvedValue({
          session_id: "sess-1",
          session_status: "submitted",
          report_available: true,
          confidence: 0.8,
          needs_human_review: false,
          trigger_codes: ["SUM-1"],
          trigger_count: 1,
          last_scored_at: "2026-03-01T10:20:00Z",
          scoring_version_lock: null,
          has_human_review: false,
          final_score_source: "model",
          final_confidence: 0.8,
        }),
        getReport: vi.fn().mockResolvedValue({
          score_result: {
            dimension_evidence: {
              problem_framing: { score: 0.81, rationale: "Strong framing" },
              sql_proficiency: { score: 0.64, rationale: "Window function gap" },
            },
            trigger_codes: ["RPT-1"],
            trigger_impacts: [{ code: "RPT-1", delta: -0.22 }],
          },
        }),
      }),
    )

    const snapshot = await loadReportDetailSnapshot("sess-1")

    expect(snapshot.error).toBeNull()
    expect(snapshot.evaluation_bundle?.coDesignAlignment).toEqual([
      { dimension: "Problem Framing", score: 81, note: "Strong framing" },
      { dimension: "Sql Proficiency", score: 64, note: "Window function gap" },
    ])
    expect(snapshot.evaluation_bundle?.triggerRationale).toEqual([
      { code: "RPT-1", rationale: "Model impact delta -0.220", impact: "negative" },
    ])
  })

  it("builds an approach narrative and governance trace for employer reports", async () => {
    process.env.MOONSHOT_ALLOW_FIXTURE_TIMELINE = "false"
    mockCreateMoonshotClientFromEnv.mockReturnValue(
      buildClient({
        getSession: vi.fn().mockResolvedValue({
          id: "sess-1",
          tenant_id: "tenant_a",
          task_family_id: "tf-1",
          candidate_id: "candidate_1",
          status: "scored",
          policy: { coach_mode: "assessment_ai_assisted", demo_template_id: "tpl_jda_quality" },
          final_response: "Escalate the dashboard mismatch as P1, isolate the ETL break, and restore trust with a verified recount.",
          created_at: "2026-03-01T10:00:00Z",
          updated_at: "2026-03-01T10:10:00Z",
        }),
        getReportSummary: vi.fn().mockResolvedValue({
          session_id: "sess-1",
          session_status: "scored",
          report_available: true,
          confidence: 0.84,
          needs_human_review: false,
          trigger_codes: ["RPT-2"],
          trigger_count: 1,
          last_scored_at: "2026-03-01T10:20:00Z",
          scoring_version_lock: {
            scorer_version: "0.2.0",
            rubric_version: "0.1.0",
            task_family_version: "0.1.0",
            model_hash: "abc123",
          },
          has_human_review: false,
          final_score_source: "model",
          final_confidence: 0.84,
        }),
        getReport: vi.fn().mockResolvedValue({
          interpretation: {
            summary: "The candidate showed strong judgment by validating the discrepancy before escalating.",
          },
          score_result: {
            dimension_evidence: {
              escalation_judgment: { score: 0.86, rationale: "Escalated only after validation." },
            },
            trigger_codes: ["RPT-2"],
            trigger_impacts: [],
          },
        }),
        listSessionEvents: vi.fn().mockResolvedValue({
          items: [
            { event_type: "sql_query_run", payload: { row_count: 255 }, timestamp: "2026-03-01T10:01:00Z" },
            { event_type: "copilot_invoked", payload: { source: "coach" }, timestamp: "2026-03-01T10:03:00Z" },
            {
              event_type: "verification_step_completed",
              payload: { step: "dashboard_recount" },
              timestamp: "2026-03-01T10:06:00Z",
            },
          ],
          next_cursor: null,
          limit: 250,
          total: 3,
        }),
        listRedteamRuns: vi.fn().mockResolvedValue({ items: [{ id: "rt-1" }] }),
        listFairnessSmokeRuns: vi.fn().mockResolvedValue({ items: [{ id: "fair-1" }] }),
      }),
    )

    const snapshot = await loadReportDetailSnapshot("sess-1")

    expect(snapshot.approach_narrative?.headline).toContain("moved from exploration")
    expect(snapshot.approach_narrative?.summary).toContain("validating the discrepancy")
    expect(snapshot.approach_narrative?.final_recommendation).toContain("Escalate the dashboard mismatch")
    expect(snapshot.approach_narrative?.key_evidence_moments).toHaveLength(4)
    expect(snapshot.approach_narrative?.key_evidence_moments[0]?.event_type).toBe("sql_query_run")

    expect(snapshot.governance_trace?.audit_chain_status).toBe("verified")
    expect(snapshot.governance_trace?.audit_checked_entries).toBe(8)
    expect(snapshot.governance_trace?.audit_entry_count).toBe(2)
    expect(snapshot.governance_trace?.context_trace_count).toBe(2)
    expect(snapshot.governance_trace?.context_agents).toEqual(["coach", "evaluator"])
    expect(snapshot.governance_trace?.human_review_status).toBe("clear")
    expect(snapshot.governance_trace?.redteam_run_count).toBe(1)
    expect(snapshot.governance_trace?.fairness_run_count).toBe(1)
  })
})

describe("updateHumanReviewAction validation", () => {
  beforeEach(() => {
    mockCreateMoonshotClientFromEnv.mockReset()
  })

  it("rejects override_overall_score values outside [0,1]", async () => {
    const formData = new FormData()
    formData.set("session_id", "sess-1")
    formData.set("override_overall_score", "1.3")

    const result = await updateHumanReviewAction(INITIAL_REPORT_ACTION_STATE, formData)

    expect(result.ok).toBe(false)
    expect(result.error).toBe("override_overall_score must be between 0 and 1")
    expect(mockCreateMoonshotClientFromEnv).not.toHaveBeenCalled()
  })

  it("rejects override_confidence values outside [0,1]", async () => {
    const formData = new FormData()
    formData.set("session_id", "sess-1")
    formData.set("override_confidence", "-0.1")

    const result = await updateHumanReviewAction(INITIAL_REPORT_ACTION_STATE, formData)

    expect(result.ok).toBe(false)
    expect(result.error).toBe("override_confidence must be between 0 and 1")
    expect(mockCreateMoonshotClientFromEnv).not.toHaveBeenCalled()
  })
})
