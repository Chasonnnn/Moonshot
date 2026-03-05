import { describe, it, expect } from "vitest"
import {
  computeSmartSummary,
} from "@/lib/report-analysis"
import type { ReportDetailSnapshot } from "@/actions/reports"
import type { SessionEvent } from "@/lib/moonshot/types"

const MOCK_EVENTS: SessionEvent[] = [
  { event_type: "session_started", payload: {}, timestamp: "2026-03-01T10:00:00Z" },
]

function makeSnapshot(overrides: Partial<ReportDetailSnapshot> = {}): ReportDetailSnapshot {
  return {
    session: {
      id: "sess-1",
      tenant_id: "t-1",
      task_family_id: "tf-1",
      candidate_id: "cand-1",
      status: "completed",
      policy: { coach_mode: "assessment" },
      final_response: "some response",
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-01T10:12:00Z",
    },
    summary: {
      session_id: "sess-1",
      session_status: "completed",
      report_available: true,
      confidence: 0.87,
      final_confidence: 0.87,
      final_score_source: "model",
      has_human_review: false,
      needs_human_review: false,
      trigger_codes: ["TC-01"],
      trigger_count: 1,
      last_scored_at: "2026-03-01T10:15:00Z",
      scoring_version_lock: null,
    },
    report: {
      score_result: {
        dimension_evidence: {
          "Problem Solving": { score: 0.92, confidence: 0.9, rationale: "Strong" },
          "Communication": { score: 0.78, confidence: 0.85, rationale: "Good" },
          "Technical Skill": { score: 0.65, confidence: 0.8, rationale: "Adequate" },
          "Data Analysis": { score: 0.88, confidence: 0.88, rationale: "Very good" },
          "Business Acumen": { score: 0.45, confidence: 0.7, rationale: "Weak" },
        },
      },
    },
    redteamRuns: [],
    fairnessRuns: [],
    events: MOCK_EVENTS,
    timeline_source: "real",
    timeline_warning: null,
    interpretation: null,
    human_review: null,
    demo_template_id: null,
    co_design_bundle: null,
    round_blueprint: [],
    evaluation_bundle: {
      coDesignAlignment: [
        { dimension: "Problem Solving", score: 90, note: "Excellent" },
        { dimension: "Communication", score: 75, note: "Good" },
        { dimension: "Technical Skill", score: 60, note: "Adequate" },
        { dimension: "Data Analysis", score: 85, note: "Very good" },
        { dimension: "Business Acumen", score: 40, note: "Weak" },
      ],
      roundPerformance: [
        { round: "Round 1", score: 60, note: "Warming up" },
        { round: "Round 2", score: 70, note: "Getting better" },
        { round: "Round 3", score: 85, note: "Strong finish" },
      ],
      toolProficiency: [
        { tool: "sql", score: 80 },
        { tool: "python", score: 70 },
      ],
      triggerRationale: [
        { code: "TC-01", rationale: "Detected unusual pattern", impact: "medium" },
        { code: "TC-02", rationale: "Copy-paste detected", impact: "low" },
      ],
      agentNarrative: ["Candidate performed well overall."],
    },
    error: null,
    ...overrides,
  }
}

describe("computeSmartSummary", () => {
  it("identifies top 3 strengths from report dimension evidence when available", () => {
    const result = computeSmartSummary(makeSnapshot())

    expect(result.strengths).toHaveLength(3)
    expect(result.strengths[0].dimension).toBe("Problem Solving")
    expect(result.strengths[1].dimension).toBe("Data Analysis")
    expect(result.strengths[2].dimension).toBe("Communication")
  })

  it("identifies bottom 2 weaknesses from report dimension evidence when available", () => {
    const result = computeSmartSummary(makeSnapshot())

    expect(result.weaknesses).toHaveLength(2)
    expect(result.weaknesses[0].dimension).toBe("Business Acumen")
    expect(result.weaknesses[1].dimension).toBe("Technical Skill")
  })

  it("computes improving trend from round performance", () => {
    const result = computeSmartSummary(makeSnapshot())

    expect(result.trend).toBe("improving")
  })

  it("computes declining trend when scores drop", () => {
    const snapshot = makeSnapshot({
      evaluation_bundle: {
        ...makeSnapshot().evaluation_bundle!,
        roundPerformance: [
          { round: "Round 1", score: 90, note: "Great" },
          { round: "Round 2", score: 70, note: "Dropping" },
          { round: "Round 3", score: 50, note: "Struggling" },
        ],
      },
    })
    const result = computeSmartSummary(snapshot)

    expect(result.trend).toBe("declining")
  })

  it("computes steady trend when scores stay flat", () => {
    const snapshot = makeSnapshot({
      evaluation_bundle: {
        ...makeSnapshot().evaluation_bundle!,
        roundPerformance: [
          { round: "Round 1", score: 70, note: "Ok" },
          { round: "Round 2", score: 72, note: "Ok" },
          { round: "Round 3", score: 71, note: "Ok" },
        ],
      },
    })
    const result = computeSmartSummary(snapshot)

    expect(result.trend).toBe("steady")
  })

  it("returns steady trend for single round", () => {
    const snapshot = makeSnapshot({
      evaluation_bundle: {
        ...makeSnapshot().evaluation_bundle!,
        roundPerformance: [{ round: "Round 1", score: 70, note: "Ok" }],
      },
    })
    const result = computeSmartSummary(snapshot)

    expect(result.trend).toBe("steady")
  })

  it("derives confidence level from final_confidence", () => {
    const high = computeSmartSummary(makeSnapshot({ summary: { ...makeSnapshot().summary!, final_confidence: 0.85 } }))
    expect(high.confidenceLevel).toBe("high")

    const medium = computeSmartSummary(makeSnapshot({ summary: { ...makeSnapshot().summary!, final_confidence: 0.65 } }))
    expect(medium.confidenceLevel).toBe("medium")

    const low = computeSmartSummary(makeSnapshot({ summary: { ...makeSnapshot().summary!, final_confidence: 0.4 } }))
    expect(low.confidenceLevel).toBe("low")
  })

  it("defaults to medium confidence when final_confidence is null", () => {
    const result = computeSmartSummary(makeSnapshot({ summary: { ...makeSnapshot().summary!, final_confidence: null } }))
    expect(result.confidenceLevel).toBe("medium")
  })

  it("summarizes triggers by count", () => {
    const result = computeSmartSummary(makeSnapshot())

    expect(result.triggerSummary.count).toBe(2)
    expect(result.triggerSummary.codes).toEqual(["TC-01", "TC-02"])
  })

  it("derives hiring suggestion based on overall score", () => {
    // Average report dimension_evidence score: (92+78+65+88+45)/5 = 74 → lean-hire
    const result = computeSmartSummary(makeSnapshot())
    expect(result.hiringSuggestion).toBe("lean-hire")
  })

  it("derives strong-hire for high scores", () => {
    const snapshot = makeSnapshot({
      report: null,
      evaluation_bundle: {
        ...makeSnapshot().evaluation_bundle!,
        coDesignAlignment: [
          { dimension: "A", score: 90, note: "" },
          { dimension: "B", score: 95, note: "" },
          { dimension: "C", score: 88, note: "" },
        ],
      },
    })
    const result = computeSmartSummary(snapshot)
    expect(result.hiringSuggestion).toBe("strong-hire")
  })

  it("derives no-hire for low scores", () => {
    const snapshot = makeSnapshot({
      report: null,
      evaluation_bundle: {
        ...makeSnapshot().evaluation_bundle!,
        coDesignAlignment: [
          { dimension: "A", score: 20, note: "" },
          { dimension: "B", score: 30, note: "" },
          { dimension: "C", score: 25, note: "" },
        ],
      },
    })
    const result = computeSmartSummary(snapshot)
    expect(result.hiringSuggestion).toBe("no-hire")
  })

  it("computes overall score from coDesignAlignment average", () => {
    const result = computeSmartSummary(makeSnapshot())
    // (92+78+65+88+45)/5 = 74
    expect(result.overallScore).toBe(74)
  })

  it("handles snapshot with no evaluation_bundle gracefully", () => {
    const snapshot = makeSnapshot({
      evaluation_bundle: null,
      report: null,
      summary: {
        ...makeSnapshot().summary!,
        trigger_codes: [],
        trigger_count: 0,
      },
    })
    const result = computeSmartSummary(snapshot)

    expect(result.strengths).toEqual([])
    expect(result.weaknesses).toEqual([])
    expect(result.trend).toBe("steady")
    expect(result.triggerSummary.count).toBe(0)
    expect(result.overallScore).toBe(0)
    expect(result.hiringSuggestion).toBe("no-hire")
  })

  it("falls back to report trigger codes when bundle trigger rationale is missing", () => {
    const snapshot = makeSnapshot({
      evaluation_bundle: {
        ...makeSnapshot().evaluation_bundle!,
        triggerRationale: [],
      },
      report: {
        score_result: {
          dimension_evidence: {
            "Problem Solving": { score: 0.92, confidence: 0.9, rationale: "Strong" },
          },
          trigger_codes: ["TC-RPT-1", "TC-RPT-2"],
        },
      },
      summary: {
        ...makeSnapshot().summary!,
        trigger_codes: ["TC-SUMMARY"],
      },
    })
    const result = computeSmartSummary(snapshot)

    expect(result.triggerSummary.codes).toEqual(["TC-RPT-1", "TC-RPT-2"])
    expect(result.triggerSummary.count).toBe(2)
  })

  it("handles empty dimension evidence gracefully", () => {
    const snapshot = makeSnapshot({
      evaluation_bundle: {
        coDesignAlignment: [],
        roundPerformance: [],
        toolProficiency: [],
        triggerRationale: [],
        agentNarrative: [],
      },
      report: null,
    })
    const result = computeSmartSummary(snapshot)

    expect(result.strengths).toEqual([])
    expect(result.weaknesses).toEqual([])
    expect(result.overallScore).toBe(0)
  })

  it("falls back to dimension_evidence when coDesignAlignment is empty", () => {
    const snapshot = makeSnapshot({
      evaluation_bundle: {
        coDesignAlignment: [],
        roundPerformance: [],
        toolProficiency: [],
        triggerRationale: [],
        agentNarrative: [],
      },
      report: {
        score_result: {
          dimension_evidence: {
            "Problem Solving": { score: 0.92, confidence: 0.9, rationale: "Strong" },
            "Communication": { score: 0.78, confidence: 0.85, rationale: "Good" },
          },
        },
      },
    })
    const result = computeSmartSummary(snapshot)

    // dimension_evidence scores are 0-1, scaled to 0-100
    expect(result.strengths).toHaveLength(2)
    expect(result.strengths[0].dimension).toBe("Problem Solving")
    expect(result.strengths[0].score).toBe(92)
    expect(result.overallScore).toBe(85) // (92+78)/2
  })
})
