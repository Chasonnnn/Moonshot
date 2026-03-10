import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SessionPreflight } from "@/components/candidate/session-preflight"

const mockTrack = vi.fn()

const baseSessionContext = {
  session: {
    id: "sess-1",
    status: "active",
    policy: {
      time_limit_minutes: 45,
      retention_ttl_days: 30,
      raw_content_opt_in: false,
    },
    task_prompt: "Write a SQL query",
  },
  api: {},
  isSubmitted: false,
  isExpired: false,
  track: mockTrack,
  remainingSeconds: 2700,
  mode: "assessment" as const,
  isAiDisabled: false,
  finalResponse: "",
  setFinalResponse: vi.fn(),
  setSubmitted: vi.fn(),
}

let currentContext = { ...baseSessionContext }

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => currentContext,
}))

describe("SessionPreflight", () => {
  const onReady = vi.fn()

  beforeEach(() => {
    currentContext = { ...baseSessionContext }
    onReady.mockClear()
    mockTrack.mockClear()
  })

  it("renders Begin button disabled until all checkboxes are checked", async () => {
    const user = userEvent.setup()
    render(<SessionPreflight onReady={onReady} />)

    const beginBtn = screen.getByRole("button", { name: /begin assessment/i })
    expect(beginBtn).toBeDisabled()

    const checkboxes = [
      screen.getByRole("checkbox", { name: /i understand the assessment rules/i }),
      screen.getByRole("checkbox", { name: /i have a stable internet connection/i }),
      screen.getByRole("checkbox", { name: /i am ready to begin/i }),
    ]

    // Check first two — still disabled
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])
    expect(beginBtn).toBeDisabled()

    // Check third — now enabled
    await user.click(checkboxes[2])
    expect(beginBtn).toBeEnabled()
  })

  it("calls onReady when Begin is clicked after all checked", async () => {
    const user = userEvent.setup()
    render(<SessionPreflight onReady={onReady} />)

    const checkboxes = screen.getAllByRole("checkbox")
    for (const cb of checkboxes) {
      await user.click(cb)
    }

    await user.click(screen.getByRole("button", { name: /begin assessment/i }))
    expect(onReady).toHaveBeenCalledOnce()
  })

  it("renders a single main landmark and page heading", () => {
    render(<SessionPreflight onReady={onReady} />)

    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: /assessment preflight/i })).toBeInTheDocument()
  })

  it("shows time limit", () => {
    render(<SessionPreflight onReady={onReady} />)
    expect(screen.getByText(/45 minutes/i)).toBeInTheDocument()
  })

  it("shows no time limit text when null", () => {
    currentContext = {
      ...baseSessionContext,
      session: {
        ...baseSessionContext.session,
        policy: {
          ...baseSessionContext.session.policy,
          time_limit_minutes: null,
        },
      },
    }
    render(<SessionPreflight onReady={onReady} />)
    expect(screen.getByText(/no time limit/i)).toBeInTheDocument()
  })

  it("shows data retention notice from policy", () => {
    render(<SessionPreflight onReady={onReady} />)
    expect(screen.getByText(/30 days/i)).toBeInTheDocument()
  })

  it("shows assessment mode rule", () => {
    currentContext = { ...baseSessionContext, mode: "assessment" as const }
    render(<SessionPreflight onReady={onReady} />)
    expect(screen.getByText(/scored assessment/i)).toBeInTheDocument()
  })

  it("shows practice mode rule", () => {
    currentContext = { ...baseSessionContext, mode: "practice" as const }
    render(<SessionPreflight onReady={onReady} />)
    expect(screen.getByText(/practice session/i)).toBeInTheDocument()
  })

  it("shows assessment_no_ai mode rule", () => {
    currentContext = {
      ...baseSessionContext,
      mode: "assessment_no_ai" as const,
      isAiDisabled: true,
    }
    render(<SessionPreflight onReady={onReady} />)
    expect(screen.getByText(/ai assistance is disabled/i)).toBeInTheDocument()
  })

  it("shows assessment_ai_assisted mode rule", () => {
    currentContext = {
      ...baseSessionContext,
      mode: "assessment_ai_assisted" as const,
    }
    render(<SessionPreflight onReady={onReady} />)
    expect(screen.getByText(/scores are labeled as ai-assisted/i)).toBeInTheDocument()
  })
})
