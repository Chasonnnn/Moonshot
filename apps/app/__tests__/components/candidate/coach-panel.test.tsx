import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CoachPanel } from "@/components/candidate/coach-panel"

const mockCoachMessage = vi.fn()
const mockCoachFeedback = vi.fn()
const mockTrack = vi.fn()

const mockCoachMessages: unknown[] = []
const mockPushCoachMessage = vi.fn((msg: unknown) => mockCoachMessages.push(msg))

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    api: {
      coachMessage: mockCoachMessage,
      coachFeedback: mockCoachFeedback,
    },
    isSubmitted: false,
    isExpired: false,
    isAiDisabled: false,
    track: mockTrack,
    autoPlay: false,
    coachMessages: mockCoachMessages,
    pushCoachMessage: mockPushCoachMessage,
  }),
}))

describe("CoachPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCoachMessages.length = 0
  })

  it("renders input and send button", () => {
    render(<CoachPanel />)
    expect(screen.getByPlaceholderText(/ask the coach/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })

  it("sends message and displays coach response", async () => {
    mockCoachMessage.mockResolvedValueOnce({
      allowed: true,
      response: "Try using a GROUP BY clause",
      policy_reason: "allowed",
      policy_decision_code: null,
      policy_version: null,
      policy_hash: null,
      blocked_rule_id: null,
    })

    render(<CoachPanel />)
    const input = screen.getByPlaceholderText(/ask the coach/i)
    await userEvent.type(input, "How do I aggregate data?")
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText("Try using a GROUP BY clause")).toBeInTheDocument()
    })
    expect(screen.getByText("How do I aggregate data?")).toBeInTheDocument()
    expect(mockTrack).toHaveBeenCalledWith(
      "copilot_invoked",
      expect.objectContaining({ message_length: "How do I aggregate data?".length })
    )
    const invokePayload = mockTrack.mock.calls.find(([eventType]) => eventType === "copilot_invoked")?.[1]
    expect(invokePayload).not.toHaveProperty("message")
  })

  it("shows policy-blocked response with warning styling", async () => {
    mockCoachMessage.mockResolvedValueOnce({
      allowed: false,
      response: "I can't help with that specific question.",
      policy_reason: "Answer reveals solution structure",
      policy_decision_code: "BLOCKED_DIRECT_ANSWER",
      policy_version: "1.0",
      policy_hash: "abc123",
      blocked_rule_id: "rule_1",
    })

    render(<CoachPanel />)
    const input = screen.getByPlaceholderText(/ask the coach/i)
    await userEvent.type(input, "Give me the answer")
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText("I can't help with that specific question.")).toBeInTheDocument()
      expect(screen.getByText("Answer reveals solution structure")).toBeInTheDocument()
    })
  })

  it("feedback buttons call coachFeedback API", async () => {
    mockCoachMessage.mockResolvedValueOnce({
      allowed: true,
      response: "Good question!",
      policy_reason: "allowed",
      policy_decision_code: null,
      policy_version: null,
      policy_hash: null,
      blocked_rule_id: null,
    })
    mockCoachFeedback.mockResolvedValue({})

    render(<CoachPanel />)
    const input = screen.getByPlaceholderText(/ask the coach/i)
    await userEvent.type(input, "test")
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText("Good question!")).toBeInTheDocument()
    })

    // Click thumbs up
    const thumbsUp = screen.getByRole("button", { name: "Helpful" })
    fireEvent.click(thumbsUp)

    await waitFor(() => {
      expect(mockCoachFeedback).toHaveBeenCalledWith(true, [])
    })
  })
})
