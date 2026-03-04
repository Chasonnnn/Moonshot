import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DashboardWorkspace } from "@/components/candidate/dashboard-workspace"
import { CandidateApiError } from "@/lib/moonshot/candidate-client"

const mockGetDashboardState = vi.fn()
const mockDashboardAction = vi.fn()
const mockTrack = vi.fn()

// Stable reference to prevent useEffect re-fires on every render
const mockApi = {
  getDashboardState: mockGetDashboardState,
  dashboardAction: mockDashboardAction,
}

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    api: mockApi,
    isSubmitted: false,
    isExpired: false,
    track: mockTrack,
  }),
}))

describe("DashboardWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders annotations after successful load", async () => {
    mockGetDashboardState.mockResolvedValueOnce({
      filters: {},
      view: "default",
      annotations: ["First note", "Second note"],
    })

    render(<DashboardWorkspace />)

    await waitFor(() => {
      expect(screen.getByText("First note")).toBeInTheDocument()
      expect(screen.getByText("Second note")).toBeInTheDocument()
    })

    expect(screen.getByText("Annotations (2)")).toBeInTheDocument()
  })

  it("shows error with retry button when initial load fails", async () => {
    mockGetDashboardState.mockRejectedValueOnce(
      new CandidateApiError("Session expired", 401, "auth_error")
    )

    render(<DashboardWorkspace />)

    await waitFor(() => {
      expect(screen.getByText("Session expired")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()

    // Annotations UI should not be rendered when state is null
    expect(screen.queryByText(/annotations/i)).not.toBeInTheDocument()
  })

  it("retry button re-fetches dashboard state", async () => {
    mockGetDashboardState.mockRejectedValueOnce(new Error("Network error"))

    render(<DashboardWorkspace />)

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })

    // Now mock a successful response for the retry
    mockGetDashboardState.mockResolvedValueOnce({
      filters: {},
      view: "default",
      annotations: [],
    })

    fireEvent.click(screen.getByRole("button", { name: /retry/i }))

    await waitFor(() => {
      expect(screen.getByText("Annotations (0)")).toBeInTheDocument()
    })

    expect(screen.queryByText("Network error")).not.toBeInTheDocument()
    expect(mockGetDashboardState).toHaveBeenCalledTimes(2)
  })

  it("adds annotation and updates state", async () => {
    mockGetDashboardState.mockResolvedValueOnce({
      filters: {},
      view: "default",
      annotations: [],
    })
    mockDashboardAction.mockResolvedValueOnce({
      filters: {},
      view: "default",
      annotations: ["New insight"],
    })

    render(<DashboardWorkspace />)

    await waitFor(() => {
      expect(screen.getByText("Annotations (0)")).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText("Add a note...")
    await userEvent.type(input, "New insight")
    fireEvent.click(screen.getByRole("button", { name: /add note/i }))

    await waitFor(() => {
      expect(mockDashboardAction).toHaveBeenCalledWith("annotate", { note: "New insight" })
    })

    await waitFor(() => {
      expect(screen.getByText("New insight")).toBeInTheDocument()
      expect(screen.getByText("Annotations (1)")).toBeInTheDocument()
    })

    // Input should be cleared after successful add
    expect(input).toHaveValue("")
  })

  it("shows error when adding annotation fails", async () => {
    mockGetDashboardState.mockResolvedValueOnce({
      filters: {},
      view: "default",
      annotations: [],
    })
    mockDashboardAction.mockRejectedValueOnce(
      new CandidateApiError("CSRF token mismatch", 403, "csrf_error")
    )

    render(<DashboardWorkspace />)

    await waitFor(() => {
      expect(screen.getByText("Annotations (0)")).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText("Add a note...")
    await userEvent.type(input, "My note")
    fireEvent.click(screen.getByRole("button", { name: /add note/i }))

    await waitFor(() => {
      expect(screen.getByText("CSRF token mismatch")).toBeInTheDocument()
    })
  })

  it("renders empty annotation list on successful load with no annotations", async () => {
    mockGetDashboardState.mockResolvedValueOnce({
      filters: {},
      view: "default",
      annotations: [],
    })

    render(<DashboardWorkspace />)

    await waitFor(() => {
      expect(screen.getByText("Annotations (0)")).toBeInTheDocument()
    })

    expect(screen.getByPlaceholderText("Add a note...")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument()
  })

  it("Enter key submits annotation", async () => {
    mockGetDashboardState.mockResolvedValueOnce({
      filters: {},
      view: "default",
      annotations: [],
    })
    mockDashboardAction.mockResolvedValueOnce({
      filters: {},
      view: "default",
      annotations: ["Enter note"],
    })

    render(<DashboardWorkspace />)

    await waitFor(() => {
      expect(screen.getByText("Annotations (0)")).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText("Add a note...")
    await userEvent.type(input, "Enter note")
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(mockDashboardAction).toHaveBeenCalledWith("annotate", { note: "Enter note" })
    })
  })
})
