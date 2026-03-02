import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SessionWorkspace } from "@/components/candidate/session-workspace"

// Mock the candidate API client
const mockApi = {
  runSql: vi.fn(),
  getSqlHistory: vi.fn().mockResolvedValue({ items: [] }),
  getDashboardState: vi.fn().mockResolvedValue({ filters: {}, view: "default", annotations: [] }),
  dashboardAction: vi.fn(),
  coachMessage: vi.fn(),
  coachFeedback: vi.fn(),
  ingestEvents: vi.fn().mockResolvedValue({ accepted: 0 }),
}

vi.mock("@/lib/moonshot/candidate-client", () => {
  class MockCandidateApiClient {
    constructor() {
      return mockApi
    }
  }
  class CandidateApiError extends Error {
    status: number
    errorCode: string
    constructor(msg: string, status: number, code: string) {
      super(msg)
      this.status = status
      this.errorCode = code
    }
  }
  return { CandidateApiClient: MockCandidateApiClient, CandidateApiError }
})

// Mock csrf
vi.mock("@/lib/moonshot/csrf", () => ({
  getCsrfToken: vi.fn(() => "csrf-token"),
}))

// Mock server action
vi.mock("@/actions/session", () => ({
  submitSession: vi.fn(),
}))

const mockSession = {
  id: "smoke-session-1",
  tenant_id: "t1",
  task_family_id: "tf1",
  candidate_id: "c1",
  status: "active",
  policy: {
    raw_content_opt_in: false,
    retention_ttl_days: 90,
    time_limit_minutes: 60,
  },
  final_response: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  task_prompt: "Analyze the sales data and write a summary of your findings.",
}

async function completePreflight() {
  // Check all 3 preflight checkboxes and click Begin
  const checkboxes = screen.getAllByRole("checkbox")
  for (const cb of checkboxes) {
    await userEvent.click(cb)
  }
  fireEvent.click(screen.getByRole("button", { name: /begin assessment/i }))
}

describe("Session Smoke Test", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getSqlHistory.mockResolvedValue({ items: [] })
    mockApi.getDashboardState.mockResolvedValue({ filters: {}, view: "default", annotations: [] })
    mockApi.ingestEvents.mockResolvedValue({ accepted: 0 })
  })

  it("renders the full workspace layout", async () => {
    render(<SessionWorkspace session={mockSession} />)
    await completePreflight()

    expect(screen.getByText("Moonshot")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(
      screen.getByText("Analyze the sales data and write a summary of your findings.")
    ).toBeInTheDocument()
    expect(screen.getByText("SQL Workspace")).toBeInTheDocument()
    expect(screen.getByText("Coach")).toBeInTheDocument()
  })

  it("runs SQL query and displays results", async () => {
    mockApi.runSql.mockResolvedValueOnce({
      ok: true,
      row_count: 2,
      columns: ["order_id", "total"],
      rows: [
        { order_id: 1, total: 100 },
        { order_id: 2, total: 200 },
      ],
      runtime_ms: 15,
    })

    render(<SessionWorkspace session={mockSession} />)
    await completePreflight()

    // Use fireEvent.change for faster state update in integration test
    const sqlTextarea = screen.getByPlaceholderText(/write your sql/i)
    fireEvent.change(sqlTextarea, { target: { value: "SELECT * FROM orders" } })

    // Use keyboard shortcut
    fireEvent.keyDown(sqlTextarea, { key: "Enter", metaKey: true })

    await waitFor(() => {
      expect(mockApi.runSql).toHaveBeenCalledWith("SELECT * FROM orders")
    })

    await waitFor(() => {
      expect(screen.getByText("100")).toBeInTheDocument()
      expect(screen.getByText("200")).toBeInTheDocument()
    })
  })

  it("sends coach message and receives response", async () => {
    mockApi.coachMessage.mockResolvedValueOnce({
      allowed: true,
      response: "Focus on trends in the data.",
      policy_reason: "allowed",
      policy_decision_code: null,
      policy_version: null,
      policy_hash: null,
      blocked_rule_id: null,
    })

    render(<SessionWorkspace session={mockSession} />)
    await completePreflight()

    const coachInput = screen.getByPlaceholderText(/ask the coach/i)
    fireEvent.change(coachInput, { target: { value: "What should I look for?" } })
    fireEvent.keyDown(coachInput, { key: "Enter" })

    await waitFor(() => {
      expect(mockApi.coachMessage).toHaveBeenCalledWith("What should I look for?")
    })

    await waitFor(() => {
      expect(screen.getByText("Focus on trends in the data.")).toBeInTheDocument()
    })
  })

  it("writes final response and opens submit dialog", async () => {
    render(<SessionWorkspace session={mockSession} />)
    await completePreflight()

    const responseTextarea = screen.getByPlaceholderText(/write your final response/i)
    await userEvent.type(
      responseTextarea,
      "Based on my analysis, I found significant trends in the quarterly data."
    )

    fireEvent.click(screen.getByRole("button", { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByText("Submit your assessment")).toBeInTheDocument()
      expect(screen.getByText(/you cannot make changes/i)).toBeInTheDocument()
    })
  })

  it("locks workspace and shows hard-stop dialog when expired", async () => {
    const expiredSession = {
      ...mockSession,
      created_at: "2024-01-01T00:00:00Z",
      policy: {
        ...mockSession.policy,
        time_limit_minutes: 1,
      },
    }
    render(<SessionWorkspace session={expiredSession} />)
    await completePreflight()

    await waitFor(() => {
      expect(screen.getByText("Session time limit reached")).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText(/write your final response/i)).toBeDisabled()
    const runButton = document.querySelector('button[aria-label="Run"]') as HTMLButtonElement | null
    const sendButton = document.querySelector('button[aria-label="Send"]') as HTMLButtonElement | null
    expect(runButton).not.toBeNull()
    expect(sendButton).not.toBeNull()
    expect(runButton).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })
})
