import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock the server action module before importing the component
vi.mock("@/actions/session", () => ({
  submitSession: vi.fn(),
}))

import { SubmitDialog } from "@/components/candidate/submit-dialog"

const mockSetSubmitted = vi.fn()
let mockFinalResponse = "This is a valid final response for testing"
let mockIsSubmitted = false
let mockSession = {
  id: "session-1",
  policy: { raw_content_opt_in: false, retention_ttl_days: 90, time_limit_minutes: null },
  status: "active",
  tenant_id: "t1",
  task_family_id: "tf1",
  candidate_id: "c1",
  final_response: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    session: mockSession,
    isSubmitted: mockIsSubmitted,
    setSubmitted: mockSetSubmitted,
    finalResponse: mockFinalResponse,
  }),
}))

// Mock the server action
const mockSubmitAction = vi.fn()
vi.mock("react", async () => {
  const actual = await vi.importActual("react")
  return {
    ...actual,
    useActionState: (action: unknown, initialState: unknown) => {
      return [
        mockSubmitAction.mock.results.length > 0
          ? mockSubmitAction.mock.results[mockSubmitAction.mock.results.length - 1].value
          : initialState,
        (formData: FormData) => {
          mockSubmitAction(formData)
        },
        false,
      ]
    },
  }
})

describe("SubmitDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFinalResponse = "This is a valid final response for testing"
    mockIsSubmitted = false
    mockSession = {
      id: "session-1",
      policy: { raw_content_opt_in: false, retention_ttl_days: 90, time_limit_minutes: null },
      status: "active",
      tenant_id: "t1",
      task_family_id: "tf1",
      candidate_id: "c1",
      final_response: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    }
  })

  it("opens dialog with confirmation text", () => {
    render(<SubmitDialog open onOpenChange={() => {}} />)
    expect(screen.getByText("Submit your assessment")).toBeInTheDocument()
    expect(
      screen.getByText("You cannot make changes after submitting.")
    ).toBeInTheDocument()
  })

  it("shows validation message when response is too short", () => {
    mockFinalResponse = "short"
    render(<SubmitDialog open onOpenChange={() => {}} />)
    expect(
      screen.getByText(/please write a response before submitting/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })

  it("enables confirm button when response is valid", () => {
    render(<SubmitDialog open onOpenChange={() => {}} />)
    expect(screen.getByRole("button", { name: /confirm/i })).not.toBeDisabled()
  })

  it("shows policy notice when raw_content_opt_in is false", () => {
    render(<SubmitDialog open onOpenChange={() => {}} />)
    expect(
      screen.getByText(/will not be stored after scoring/i)
    ).toBeInTheDocument()
  })

  it("does not show policy notice when raw_content_opt_in is true", () => {
    mockSession = {
      ...mockSession,
      policy: { raw_content_opt_in: true, retention_ttl_days: 90, time_limit_minutes: null },
    }
    render(<SubmitDialog open onOpenChange={() => {}} />)
    expect(
      screen.queryByText(/will not be stored after scoring/i)
    ).not.toBeInTheDocument()
  })
})
