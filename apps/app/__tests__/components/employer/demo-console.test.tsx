import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/actions/pilot", () => ({
  loadLiveModelOptions: vi.fn(async () => ({
    options: [{ id: "anthropic/claude-opus-4-6", label: "anthropic/claude-opus-4-6" }],
    availableModelIds: ["anthropic/claude-opus-4-6"],
    defaultModelId: "anthropic/claude-opus-4-6",
    error: null,
  })),
  prepareDemoPreview: vi.fn(),
  runDemoFastPath: vi.fn(),
  runDemoAutoComplete: vi.fn(),
}))

vi.mock("@/actions/reports", () => ({
  loadReportDetailSnapshot: vi.fn(),
}))

vi.mock("@/components/employer/demo-generating-animation", () => ({
  DemoGeneratingAnimation: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" onClick={onComplete}>
      Complete generation
    </button>
  ),
}))

vi.mock("@/components/employer/report-review-console", () => ({
  ReportReviewConsole: () => <div data-testid="report-review-console" />,
}))

import {
  prepareDemoPreview,
  runDemoAutoComplete,
  runDemoFastPath,
} from "@/actions/pilot"
import { loadReportDetailSnapshot } from "@/actions/reports"
import { DemoConsole } from "@/components/employer/demo-console"
import { getStageDiagnosticKey } from "@/components/employer/demo-stage-diagnostic-key"

const BASE_PILOT_SNAPSHOT = {
  ok: true,
  apiVersion: "0.6.0",
  schemaVersion: "0.6.0",
  caseCount: 0,
  jobCount: 0,
  error: null,
}

const BASE_REPORT_SNAPSHOT = {
  session: null,
  summary: {
    scoring_version_lock: {
      scorer_version: "1.2.0",
      rubric_version: "2.0.0",
      task_family_version: "1.0.0",
      model_hash: "abc123",
    },
  },
  report: null,
  redteamRuns: [],
  fairnessRuns: [],
  events: [],
  timeline_source: "real",
  timeline_warning: null,
  interpretation: null,
  human_review: null,
  demo_template_id: "tpl_data_analyst",
  co_design_bundle: null,
  round_blueprint: [],
  evaluation_bundle: null,
  computed_analysis: null,
  approach_narrative: null,
  governance_trace: {
    audit_chain_status: "verified",
    audit_chain_detail: "Audit chain verified.",
    audit_checked_entries: 8,
    audit_entry_count: 3,
    context_trace_count: 2,
    context_agents: ["coach", "evaluator"],
    context_keys: ["case_scenario", "score_result"],
    human_review_status: "clear",
    redteam_run_count: 1,
    fairness_run_count: 1,
    timeline_source: "real",
  },
  error: null,
} as const

const mockedPrepareDemoPreview = vi.mocked(prepareDemoPreview)
const mockedRunDemoFastPath = vi.mocked(runDemoFastPath)
const mockedRunDemoAutoComplete = vi.mocked(runDemoAutoComplete)
const mockedLoadReportDetailSnapshot = vi.mocked(loadReportDetailSnapshot)

function renderConsole() {
  return render(<DemoConsole snapshot={BASE_PILOT_SNAPSHOT} />)
}

describe("DemoConsole template selection", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockedPrepareDemoPreview.mockResolvedValue({
      mode: "live",
      caseId: "case-live",
      taskFamilyId: "tf-live",
      generatedVariantCount: 2,
      variants: [
        {
          id: "var-live-1",
          skill: "sql",
          difficultyLevel: "Advanced",
          roundHint: "round_1",
          promptSummary: "Live generated variant",
          deliverables: ["analysis_summary"],
          estimatedMinutes: 15,
          artifactRefs: ["funnel_weekly.csv"],
        },
      ],
      rubric: [
        {
          key: "verification",
          anchor: "Verify before recommending.",
          evaluationPoints: ["checks"],
          evidenceSignals: ["validation"],
          commonFailureModes: ["guessing"],
          scoreBands: { "5": "Strong" },
        },
      ],
      diagnostics: [
        {
          stage: "generate",
          status: "ok",
          latency_ms: 412,
          detail: "Generated preview",
          job_id: "job-live",
          request_id: "req-live",
          model: "anthropic/claude-opus-4-6",
        },
      ],
      error: null,
    })

    mockedRunDemoFastPath.mockResolvedValue({
      mode: "fixture",
      sessionId: "sess-1",
      candidateUrl: "/session/sess-1/start",
      taskFamilyId: "tf-1",
      generatedVariantCount: 12,
      diagnostics: [],
      error: null,
    })

    mockedRunDemoAutoComplete.mockResolvedValue({
      diagnostics: [],
      error: null,
    })

    mockedLoadReportDetailSnapshot.mockResolvedValue(BASE_REPORT_SNAPSHOT as never)
  })

  it("defaults to the flagship analyst selection and renders the story summary", () => {
    renderConsole()

    expect(screen.getByText("Operator-led demo story")).toBeInTheDocument()
    expect(screen.getByText("KPI Discrepancy Investigation")).toBeInTheDocument()
    expect(screen.getByText("SQL Data Quality Triage")).toBeInTheDocument()
    expect(screen.getByText("Stakeholder Ambiguity Handling")).toBeInTheDocument()
    expect(screen.getByText("Customer Support Escalation Judgment")).toBeInTheDocument()
    expect(screen.getByText("Marketplace Growth Strategy Simulation")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /KPI Discrepancy Investigation/i })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Start flagship demo" })).toBeInTheDocument()
  })

  it("shows the updated narrative and step indicators initially", () => {
    renderConsole()

    expect(screen.getAllByText("Simulation Gallery").length).toBeGreaterThan(0)
    expect(screen.getByText("Co-design")).toBeInTheDocument()
    expect(screen.getByText("Candidate work trace")).toBeInTheDocument()
    expect(screen.getByText("Evaluation")).toBeInTheDocument()
    expect(screen.getByText("Governance")).toBeInTheDocument()
    expect(screen.getByText("What the candidate was asked to do")).toBeInTheDocument()
    expect(screen.getByText("What evidence Moonshot captured")).toBeInTheDocument()
    expect(screen.getByText("Why the employer can trust the decision")).toBeInTheDocument()
  })

  it("renders hybrid and full live mode controls", () => {
    renderConsole()

    expect(screen.getByRole("button", { name: "Hybrid fixture path" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fully live mode" })).toBeInTheDocument()
  })

  it("shows operators panel in fully live mode", async () => {
    const user = userEvent.setup()
    renderConsole()

    await user.click(screen.getByRole("button", { name: "Fully live mode" }))

    expect(screen.getByText("Operators Panel")).toBeInTheDocument()
    expect(screen.getByText(/anthropic\/claude-opus-4-6/)).toBeInTheDocument()
    expect(screen.getByLabelText("Agent Profile")).toBeInTheDocument()
  })

  it("allows editing live co-design prompts with locked schema contract", async () => {
    const user = userEvent.setup()
    renderConsole()

    await user.click(screen.getByRole("button", { name: "Fully live mode" }))
    await user.click(screen.getByRole("button", { name: "Start flagship demo" }))

    const jobDescriptionHeader = screen.getByText("Detailed Job Description").parentElement
    expect(jobDescriptionHeader).toBeTruthy()
    await user.click(within(jobDescriptionHeader as HTMLElement).getByRole("button", { name: "Edit" }))
    const jdPrompt = screen.getByLabelText("Detailed Job Description") as HTMLTextAreaElement
    expect(jdPrompt).toHaveFocus()
    expect(jdPrompt.value.length).toBeGreaterThan(0)
    await user.clear(jdPrompt)
    await user.type(jdPrompt, "Custom live JD for anomaly triage and stakeholder reporting.")
    expect(jdPrompt.value).toContain("Custom live JD")
    await user.click(within(jobDescriptionHeader as HTMLElement).getByRole("button", { name: "Done" }))

    expect(screen.queryByLabelText("Detailed Job Description")).toBeNull()

    const sampleTasksHeader = screen.getByText("Sample Tasks").parentElement
    expect(sampleTasksHeader).toBeTruthy()
    const sampleTasksEditButton = within(sampleTasksHeader as HTMLElement).getByRole("button", { name: "Edit" })
    sampleTasksEditButton.focus()
    expect(sampleTasksEditButton).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(screen.getByLabelText("Sample Tasks")).toBeInTheDocument()
    expect(screen.getByLabelText("Sample Tasks")).toHaveFocus()

    const rubricBlueprintHeader = screen.getByText("Rubric Blueprint").parentElement
    expect(rubricBlueprintHeader).toBeTruthy()
    await user.click(within(rubricBlueprintHeader as HTMLElement).getByRole("button", { name: "Edit" }))
    expect(screen.getByLabelText("Rubric Blueprint")).toBeInTheDocument()

    const difficultyHeader = screen.getByText("Designed Incremental Difficulty Levels").parentElement
    expect(difficultyHeader).toBeTruthy()
    await user.click(within(difficultyHeader as HTMLElement).getByRole("button", { name: "Edit" }))
    expect(screen.getByLabelText("Designed Incremental Difficulty Levels")).toBeInTheDocument()

    const agentNotesHeader = screen.getByText("Agent Co-Design Notes").parentElement
    expect(agentNotesHeader).toBeTruthy()
    await user.click(within(agentNotesHeader as HTMLElement).getByRole("button", { name: "Edit" }))
    expect(screen.getByLabelText("Agent Co-Design Notes")).toBeInTheDocument()
    expect(screen.getByText("Live Response Contract (Locked Schema)")).toBeInTheDocument()
  })

  it("surfaces evaluation preview data before the session starts", async () => {
    const user = userEvent.setup()
    renderConsole()

    await user.click(screen.getByRole("button", { name: "Start flagship demo" }))
    await user.click(screen.getByRole("button", { name: "Continue to Generate" }))
    await user.click(screen.getByRole("button", { name: "Complete generation" }))

    expect(screen.getByText("Co-design alignment")).toBeInTheDocument()
    expect(screen.getByText("Trigger rationale to preview")).toBeInTheDocument()
    expect(screen.getByText("Round progression")).toBeInTheDocument()
  })

  it("renders explicit live proof failure state without falling back to fixture success", async () => {
    const user = userEvent.setup()
    mockedPrepareDemoPreview.mockResolvedValueOnce({
      mode: "live",
      caseId: null,
      taskFamilyId: null,
      generatedVariantCount: 0,
      variants: [],
      rubric: [],
      diagnostics: [
        {
          stage: "generate",
          status: "error",
          latency_ms: 987,
          detail: "provider timeout",
          job_id: "job-live-timeout",
          request_id: "req-live-timeout",
          model: "anthropic/claude-opus-4-6",
        },
      ],
      error: "provider timeout",
    })

    renderConsole()

    await user.click(screen.getByRole("button", { name: "Start flagship demo" }))
    await user.click(screen.getByRole("button", { name: "Run live co-design/generation proof" }))

    expect(await screen.findByText("Live Proof Step Failed")).toBeInTheDocument()
    expect(screen.getByText(/Live proof failed: provider timeout/i)).toBeInTheDocument()
    expect(screen.getByText("Live proof diagnostics")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue flagship fixture path" })).toBeInTheDocument()
    expect(mockedRunDemoFastPath).not.toHaveBeenCalled()
  })

  it("renders the strategy teaser after the report phase", async () => {
    const user = userEvent.setup()
    renderConsole()

    await user.click(screen.getByRole("button", { name: "Start flagship demo" }))
    await user.click(screen.getByRole("button", { name: "Continue to Generate" }))
    await user.click(screen.getByRole("button", { name: "Complete generation" }))
    await user.click(screen.getByRole("button", { name: "Confirm & Start Session" }))
    await screen.findByText("Session ready")
    await user.click(screen.getByRole("button", { name: "Skip to Report" }))

    expect(await screen.findByTestId("report-review-console")).toBeInTheDocument()
    expect(screen.getByText("Breadth teaser")).toBeInTheDocument()
    expect(screen.getByText("Marketplace Growth Strategy Simulation")).toBeInTheDocument()
    expect(screen.getByText("Why this proves breadth")).toBeInTheDocument()
  })

  it("builds stable stage diagnostic keys from request id or composite fallback", () => {
    expect(
      getStageDiagnosticKey({
        stage: "generate",
        status: "ok",
        latency_ms: 412,
        detail: "Generated preview",
        job_id: "job-1",
        request_id: "req-1",
        model: "anthropic/claude-opus-4-6",
      }),
    ).toBe("request:req-1")

    expect(
      getStageDiagnosticKey({
        stage: "score",
        status: "error",
        latency_ms: 900,
        detail: "Scoring failed",
        job_id: null,
        request_id: null,
        model: null,
      }),
    ).toBe("score|error|none|none|Scoring failed|900")
  })
})
