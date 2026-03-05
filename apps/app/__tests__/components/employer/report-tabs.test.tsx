import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("react", async () => {
  const actual = await vi.importActual("react")
  return { ...actual, useActionState: (_action: unknown, initialState: unknown) => [initialState, vi.fn(), false] }
})

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RadialBarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RadialBar: () => null,
  RadarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}))

import { ReportReviewConsole } from "@/components/employer/report-review-console"
import type { ReportDetailSnapshot } from "@/actions/reports"
import type { SessionEvent } from "@/lib/moonshot/types"

const MOCK_EVENTS: SessionEvent[] = [
  { event_type: "session_started", payload: { candidate_id: "cand_01" }, timestamp: "2026-03-01T10:00:00Z" },
  { event_type: "tab_blur_detected", payload: { duration_ms: 3200 }, timestamp: "2026-03-01T10:06:15Z" },
  { event_type: "session_submitted", payload: { final_response_length: 512 }, timestamp: "2026-03-01T10:12:00Z" },
]

const BASE_SNAPSHOT: ReportDetailSnapshot = {
  session: {
    id: "sess-1",
    tenant_id: "t-1",
    task_family_id: "tf-1",
    candidate_id: "cand-1",
    status: "completed",
    policy: { coach_mode: "assessment_ai_assisted" },
    final_response: "SELECT COUNT(*) FROM orders WHERE status = 'shipped';",
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
    scoring_version_lock: {
      scorer_version: "1.2.0",
      rubric_version: "2.0.0",
      task_family_version: "1.0.0",
      model_hash: "abc123",
    },
  },
  report: { interpretation: { summary: "The candidate performed well." } },
  redteamRuns: [],
  fairnessRuns: [],
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
    ],
    roundPerformance: [
      { round: "Round 1", score: 60, note: "Warming up" },
      { round: "Round 2", score: 85, note: "Strong finish" },
    ],
    toolProficiency: [{ tool: "sql", score: 80 }],
    triggerRationale: [{ code: "TC-01", rationale: "Pattern detected", impact: "medium" }],
    agentNarrative: ["Candidate performed well overall."],
  },
  computed_analysis: {
    strengths: [
      { dimension: "Problem Solving", score: 90, note: "Excellent" },
      { dimension: "Communication", score: 75, note: "Good" },
      { dimension: "Technical Skill", score: 60, note: "Adequate" },
    ],
    weaknesses: [],
    trend: "improving",
    confidenceLevel: "high",
    hiringSuggestion: "lean-hire",
    triggerSummary: { count: 1, codes: ["TC-01"] },
    overallScore: 75,
  },
  error: null,
  events: MOCK_EVENTS,
  timeline_source: "real",
  timeline_warning: null,
}

describe("ReportReviewConsole tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders all 4 tab triggers", () => {
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /output/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /integrity/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /provenance/i })).toBeInTheDocument()
  })

  it("shows Overview tab content by default including scoring label", () => {
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText("Report Summary")).toBeInTheDocument()
    expect(screen.getByText("AI Analysis")).toBeInTheDocument()
    // Scoring label for assessment_ai_assisted
    expect(screen.getByText("AI-Assisted")).toBeInTheDocument()
  })

  it("switches to Output tab and shows final response", async () => {
    const user = userEvent.setup()
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    await user.click(screen.getByRole("tab", { name: /output/i }))

    expect(screen.getByText(/SELECT COUNT/)).toBeInTheDocument()
  })

  it("shows empty state when no final response on Output tab", async () => {
    const user = userEvent.setup()
    const snapshot = {
      ...BASE_SNAPSHOT,
      session: { ...BASE_SNAPSHOT.session!, final_response: null },
    }
    render(<ReportReviewConsole sessionId="sess-1" snapshot={snapshot as ReportDetailSnapshot} />)

    await user.click(screen.getByRole("tab", { name: /output/i }))

    expect(screen.getByText(/no response submitted/i)).toBeInTheDocument()
  })

  it("switches to Integrity tab and shows event timeline", async () => {
    const user = userEvent.setup()
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    await user.click(screen.getByRole("tab", { name: /integrity/i }))

    // EventTimeline renders event badges
    expect(screen.getAllByTestId("event-badge")).toHaveLength(2)
    expect(screen.getByText("real")).toBeInTheDocument()
  })

  it("shows fixture warning and source badge when timeline is fixture", async () => {
    const user = userEvent.setup()
    const snapshot = {
      ...BASE_SNAPSHOT,
      timeline_source: "fixture" as const,
      timeline_warning: "Using fixture timeline because real event retrieval failed: not_found (request_id=req-1)",
    }
    render(<ReportReviewConsole sessionId="sess-1" snapshot={snapshot} />)

    await user.click(screen.getByRole("tab", { name: /integrity/i }))

    expect(screen.getByText("fixture")).toBeInTheDocument()
    expect(screen.getByText(/request_id=req-1/)).toBeInTheDocument()
  })

  it("integrity tier selector filters timeline entries", async () => {
    const user = userEvent.setup()
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    await user.click(screen.getByRole("tab", { name: /integrity/i }))

    expect(screen.getAllByTestId("event-badge")).toHaveLength(2)

    await user.click(screen.getByLabelText("Strict"))
    expect(screen.getAllByTestId("event-badge")).toHaveLength(3)
  })

  it("switches to Provenance tab and shows scoring version", async () => {
    const user = userEvent.setup()
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    await user.click(screen.getByRole("tab", { name: /provenance/i }))

    expect(screen.getByText(/1\.2\.0/)).toBeInTheDocument()
    expect(screen.getByText(/abc123/)).toBeInTheDocument()
  })

  it("renders Overall Score section on Overview tab", () => {
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText("Overall Score")).toBeInTheDocument()
  })

  it("uses human override score in gauge when final score source is human_override", () => {
    const snapshot = {
      ...BASE_SNAPSHOT,
      summary: {
        ...BASE_SNAPSHOT.summary!,
        final_score_source: "human_override" as const,
      },
      human_review: {
        session_id: "sess-1",
        tenant_id: "t-1",
        notes_markdown: null,
        tags: [],
        override_overall_score: 0.62,
        override_confidence: null,
        dimension_overrides: {},
        reviewer_id: "reviewer-1",
        created_at: "2026-03-01T10:16:00Z",
        updated_at: "2026-03-01T10:16:00Z",
      },
    }
    render(<ReportReviewConsole sessionId="sess-1" snapshot={snapshot} />)

    expect(screen.getByText("62")).toBeInTheDocument()
  })

  it("renders Smart Summary section on Overview tab", () => {
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText("Smart Summary")).toBeInTheDocument()
  })

  it("renders Dimension Radar and Dimension Scores charts when evaluation bundle present", () => {
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText("Dimension Radar")).toBeInTheDocument()
    expect(screen.getByText("Dimension Scores")).toBeInTheDocument()
  })

  it("renders Round-by-Round Performance chart when rounds present", () => {
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText("Round-by-Round Performance")).toBeInTheDocument()
  })

  it("shows smart summary strengths and weaknesses", () => {
    render(<ReportReviewConsole sessionId="sess-1" snapshot={BASE_SNAPSHOT} />)

    expect(screen.getByText("Strengths")).toBeInTheDocument()
    // Top strength from coDesignAlignment appears in smart summary and scorecard
    expect(screen.getAllByText("Problem Solving").length).toBeGreaterThanOrEqual(1)
  })

  it("hides charts when no evaluation bundle", () => {
    const snapshot = {
      ...BASE_SNAPSHOT,
      evaluation_bundle: null,
    }
    render(<ReportReviewConsole sessionId="sess-1" snapshot={snapshot as ReportDetailSnapshot} />)

    expect(screen.queryByText("Dimension Radar")).not.toBeInTheDocument()
    expect(screen.queryByText("Dimension Scores")).not.toBeInTheDocument()
    // Smart Summary and Overall Score should still render (with zero state)
    expect(screen.getByText("Smart Summary")).toBeInTheDocument()
    expect(screen.getByText("Overall Score")).toBeInTheDocument()
  })

  it("shows interpretation from snapshot.interpretation when report payload does not include it", () => {
    const snapshot = {
      ...BASE_SNAPSHOT,
      report: null,
      interpretation: {
        view_id: "view-1",
        session_id: "sess-1",
        created_at: "2026-03-01T10:16:00Z",
        focus_dimensions: ["sql_proficiency"],
        include_sensitivity: true,
        weight_overrides: {},
        breakdown: {
          dimension_scores: {
            sql_proficiency: 0.72,
          },
        },
        caveats: ["Fresh server interpretation."],
        scoring_version_lock: {
          scorer_version: "1.2.0",
          rubric_version: "2.0.0",
          task_family_version: "1.0.0",
          model_hash: "abc123",
        },
      },
    }
    render(<ReportReviewConsole sessionId="sess-1" snapshot={snapshot} />)

    expect(screen.getByText(/Top dimensions from generated interpretation/i)).toBeInTheDocument()
  })
})
