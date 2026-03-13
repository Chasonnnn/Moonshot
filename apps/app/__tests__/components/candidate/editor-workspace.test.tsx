import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorWorkspace } from "@/components/candidate/editor-workspace"

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}))

const mockTrack = vi.fn()
const mockSetDeliverableContent = vi.fn()
const mockSetDeliverableId = vi.fn()
const mockSetDeliverableStatus = vi.fn()
const mockApi = {
  updateDeliverable: vi.fn(),
  createDeliverable: vi.fn(),
}
const mockSessionState = {
  api: mockApi,
  isSubmitted: false,
  isExpired: false,
  autoPlay: false,
  track: mockTrack,
  deliverableContent: "",
  setDeliverableContent: mockSetDeliverableContent,
  deliverableArtifacts: [],
  deliverableId: null,
  setDeliverableId: mockSetDeliverableId,
  setDeliverableStatus: mockSetDeliverableStatus,
}

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => mockSessionState,
}))

describe("EditorWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockSessionState, {
      isSubmitted: false,
      isExpired: false,
      autoPlay: false,
      deliverableContent: "",
      deliverableArtifacts: [],
      deliverableId: null,
    })
  })

  it("renders markdown textarea and preview", () => {
    render(<EditorWorkspace />)
    expect(screen.getByPlaceholderText(/write your report/i)).toBeInTheDocument()
    expect(screen.getByText("Preview")).toBeInTheDocument()
  })

  it("typing in editor updates shared deliverable content", async () => {
    const user = userEvent.setup()
    render(<EditorWorkspace />)
    const textarea = screen.getByPlaceholderText(/write your report/i)
    await user.type(textarea, "# Executive Summary")
    expect(mockSetDeliverableContent).toHaveBeenCalled()
  })

  it("shows word and character count", () => {
    render(<EditorWorkspace />)
    expect(screen.getByText(/0 words/)).toBeInTheDocument()
    expect(screen.getByText(/0 characters/)).toBeInTheDocument()
  })

  it("shows section templates", () => {
    render(<EditorWorkspace />)
    expect(screen.getByText(/executive summary/i)).toBeInTheDocument()
  })

  it("shows replay artifacts when autoplay evidence exists", () => {
    Object.assign(mockSessionState, {
      autoPlay: true,
      deliverableContent: "## Executive Summary\n\nFinal memo.",
      deliverableArtifacts: ["executive_memo.md", "slide_outline.md"],
    })
    render(<EditorWorkspace />)
    expect(screen.getByText("Replay input/output")).toBeInTheDocument()
    expect(screen.getByText("executive_memo.md")).toBeInTheDocument()
    expect(screen.getByText("slide_outline.md")).toBeInTheDocument()
  })
})
