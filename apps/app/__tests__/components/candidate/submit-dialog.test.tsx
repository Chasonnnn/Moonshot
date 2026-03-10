import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock the server action module before importing the component
vi.mock("@/actions/session", () => ({
  submitSession: vi.fn(),
}))

import { SubmitDialog } from "@/components/candidate/submit-dialog"

const mockSetSubmitted = vi.fn()
const mockApi = {
  updateDeliverable: vi.fn(),
  createDeliverable: vi.fn(),
  submitDeliverable: vi.fn(),
}
let mockFinalResponse = "This is a valid final response for testing"
let mockIsSubmitted = false
let mockOralRequirement = { required: false, requiredClipTypes: [] as string[], weight: 0 }
let mockIsOralComplete = true
let mockMissingOralPromptLabels: string[] = []
let mockOralResponsesError: string | null = null
let mockOralResponsesLoaded = true
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
    api: mockApi,
    session: mockSession,
    isSubmitted: mockIsSubmitted,
    setSubmitted: mockSetSubmitted,
    finalResponse: mockFinalResponse,
    deliverableContent: "",
    deliverableArtifacts: [],
    deliverableId: null,
    setDeliverableId: vi.fn(),
    deliverableStatus: null,
    setDeliverableStatus: vi.fn(),
    oralRequirement: mockOralRequirement,
    isOralComplete: mockIsOralComplete,
    missingOralPromptLabels: mockMissingOralPromptLabels,
    oralResponsesError: mockOralResponsesError,
    oralResponsesLoaded: mockOralResponsesLoaded,
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
    mockOralRequirement = { required: false, requiredClipTypes: [], weight: 0 }
    mockIsOralComplete = true
    mockMissingOralPromptLabels = []
    mockOralResponsesError = null
    mockOralResponsesLoaded = true
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

  it("blocks submit when oral-defense clips are still missing", () => {
    mockOralRequirement = { required: true, requiredClipTypes: ["presentation", "follow_up_1"], weight: 0.2 }
    mockIsOralComplete = false
    mockMissingOralPromptLabels = ["Presentation", "Follow-up 1"]

    render(<SubmitDialog open onOpenChange={() => {}} />)

    expect(screen.getByText(/complete the oral-defense clips before submitting/i)).toHaveTextContent(
      "Presentation, Follow-up 1"
    )
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })

  it("blocks submit when oral-response loading failed", () => {
    mockOralRequirement = { required: true, requiredClipTypes: ["presentation"], weight: 0.2 }
    mockOralResponsesError = "Failed to load oral responses."

    render(<SubmitDialog open onOpenChange={() => {}} />)

    expect(screen.getByText("Failed to load oral responses.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })
})
