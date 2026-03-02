import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CoachPanel } from "@/components/candidate/coach-panel"
import { SessionHeader } from "@/components/candidate/session-header"

const mockTrack = vi.fn()

const baseSessionContext = {
  api: {
    coachMessage: vi.fn(),
    coachFeedback: vi.fn(),
  },
  isSubmitted: false,
  isExpired: false,
  track: mockTrack,
  remainingSeconds: 600,
  mode: "practice" as const,
  isAiDisabled: false,
  autoPlay: false,
  fixtureData: null,
  coachMessages: [] as unknown[],
  pushCoachMessage: vi.fn(),
}

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => currentContext,
}))

let currentContext = { ...baseSessionContext }

describe("CoachPanel – assessment_no_ai locked state", () => {
  it("shows locked message when AI is disabled", () => {
    currentContext = {
      ...baseSessionContext,
      mode: "assessment_no_ai" as const,
      isAiDisabled: true,
    }

    render(<CoachPanel />)

    expect(
      screen.getByText(/ai assistance is disabled/i)
    ).toBeInTheDocument()

    const input = screen.getByPlaceholderText(/ask the coach/i)
    expect(input).toBeDisabled()
  })

  it("shows normal chat when AI is enabled", () => {
    currentContext = { ...baseSessionContext }

    render(<CoachPanel />)

    expect(
      screen.queryByText(/ai assistance is disabled/i)
    ).not.toBeInTheDocument()

    const input = screen.getByPlaceholderText(/ask the coach/i)
    expect(input).not.toBeDisabled()
  })
})

describe("SessionHeader – mode badge", () => {
  it("renders mode badge for assessment mode", () => {
    currentContext = {
      ...baseSessionContext,
      mode: "assessment" as const,
      isAiDisabled: false,
    }

    render(<SessionHeader onSubmit={vi.fn()} />)

    expect(screen.getByText("Assessment")).toBeInTheDocument()
  })

  it("renders mode badge for assessment_no_ai mode", () => {
    currentContext = {
      ...baseSessionContext,
      mode: "assessment_no_ai" as const,
      isAiDisabled: true,
    }

    render(<SessionHeader onSubmit={vi.fn()} />)

    expect(screen.getByText("No AI")).toBeInTheDocument()
  })

  it("renders mode badge for practice mode", () => {
    currentContext = {
      ...baseSessionContext,
      mode: "practice" as const,
      isAiDisabled: false,
    }

    render(<SessionHeader onSubmit={vi.fn()} />)

    expect(screen.getByText("Practice")).toBeInTheDocument()
  })
})
