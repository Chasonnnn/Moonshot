import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { DashboardWorkspace } from "@/components/candidate/dashboard-workspace"

const mockGetDashboardState = vi.fn()
const mockDashboardAction = vi.fn()
const mockSetDashboardReplayState = vi.fn()

let mockAutoPlay = false
let mockDashboardReplayState = {
  state: null,
  loading: false,
  error: null,
  actionError: null,
  note: "",
  lastActionLabel: null,
  lastActionDetail: null,
  artifactRefs: [] as string[],
}

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    api: {
      getDashboardState: mockGetDashboardState,
      dashboardAction: mockDashboardAction,
    },
    isSubmitted: false,
    isExpired: false,
    fixtureData: null,
    currentRoundIndex: 0,
    parts: [],
    activePart: 0,
    autoPlay: mockAutoPlay,
    dashboardReplayState: mockDashboardReplayState,
    setDashboardReplayState: mockSetDashboardReplayState,
  }),
}))

describe("DashboardWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAutoPlay = false
    mockDashboardReplayState = {
      state: null,
      loading: false,
      error: null,
      actionError: null,
      note: "",
      lastActionLabel: null,
      lastActionDetail: null,
      artifactRefs: [],
    }
    mockGetDashboardState.mockResolvedValue({
      view: "weekly_growth",
      filters: {},
      annotations: [],
    })
  })

  it("renders replay input and output state during autoplay", async () => {
    mockAutoPlay = true
    mockDashboardReplayState = {
      state: {
        view: "Compare daily KPI totals against the dashboard export",
        filters: { channel: "paid_social" },
        annotations: ["Document the missing-date and mislabeled-segment defects before continuing"],
      },
      loading: false,
      error: null,
      actionError: null,
      note: "",
      lastActionLabel: "Dashboard 2",
      lastActionDetail: "Document the missing-date and mislabeled-segment defects before continuing",
      artifactRefs: ["qa_checklist.md"],
    }

    render(<DashboardWorkspace />)

    expect(screen.getByText("Replay Input / Output")).toBeInTheDocument()
    expect(screen.getByText("Dashboard 2")).toBeInTheDocument()
    expect(screen.getByText(/qa_checklist\.md/i)).toBeInTheDocument()
    expect(screen.getByText("Compare daily KPI totals against the dashboard export")).toBeInTheDocument()
    expect(screen.getByText(/paid_social/i)).toBeInTheDocument()
    expect(screen.getAllByText(/missing-date and mislabeled-segment defects/i).length).toBeGreaterThan(0)
  })

  it("loads dashboard state when replay state is empty", async () => {
    render(<DashboardWorkspace />)

    await waitFor(() => {
      expect(screen.getByText("weekly_growth")).toBeInTheDocument()
    })
  })
})
