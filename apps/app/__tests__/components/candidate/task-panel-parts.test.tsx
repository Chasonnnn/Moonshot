import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskPanel } from "@/components/candidate/task-panel"

const mockSetFinalResponse = vi.fn()
const mockTrack = vi.fn()
const mockSetActivePart = vi.fn()

const defaultContext = {
  session: {
    id: "s1",
    task_prompt: "Analyze the data",
    status: "active",
    policy: { raw_content_opt_in: false, retention_ttl_days: 90, time_limit_minutes: 60 },
  },
  isSubmitted: false,
  isExpired: false,
  finalResponse: "",
  setFinalResponse: mockSetFinalResponse,
  mode: "assessment" as const,
  fixtureData: null,
  currentRoundIndex: 0,
  totalRounds: 0,
  track: mockTrack,
  parts: [],
  activePart: 0,
  setActivePart: mockSetActivePart,
  activePartRemainingSeconds: 900,
  isActivePartExpired: false,
  deliverableContent: "",
  setDeliverableContent: vi.fn(),
  deliverableArtifacts: [],
}

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => defaultContext,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}))

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe("TaskPanel with Parts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultContext.parts = []
    defaultContext.activePart = 0
    defaultContext.activePartRemainingSeconds = 900
    defaultContext.isActivePartExpired = false
  })

  it("renders task prompt when no parts", () => {
    render(<TaskPanel />)
    expect(screen.getByText("Analyze the data")).toBeInTheDocument()
  })

  it("renders staged navigation when parts exist", () => {
    defaultContext.parts = [
      {
        id: "p1",
        title: "Clarification",
        description: "Review the brief and ask targeted questions.",
        purpose: "Frame the problem before working.",
        max_questions: 3,
      },
      {
        id: "p2",
        title: "Executive Communication",
        description: "Draft the sponsor-facing readout.",
      },
    ] as any
    render(<TaskPanel />)
    expect(screen.getByText("Current Stage")).toBeInTheDocument()
    expect(screen.getByText("All Stages")).toBeInTheDocument()
    expect(screen.getByText("Clarification")).toBeInTheDocument()
    expect(screen.getByText("Executive Communication")).toBeInTheDocument()
  })

  it("shows active stage metadata and scripted events", () => {
    defaultContext.parts = [
      {
        id: "p1",
        title: "Clarification",
        description: "Review the brief and ask targeted questions.",
        purpose: "Frame the problem before working.",
        max_questions: 3,
        time_limit_minutes: 6,
        scripted_events: [
          {
            id: "evt-1",
            type: "supervisor",
            title: "Supervisor note",
            message: "Leadership needs a scoped readout for this week only.",
          },
        ],
      },
      { id: "p2", title: "Report Writing", description: "Write your report" },
    ] as any
    defaultContext.activePart = 0
    render(<TaskPanel />)
    expect(screen.getByText("Review the brief and ask targeted questions.")).toBeInTheDocument()
    expect(screen.getByText("Purpose: Frame the problem before working.")).toBeInTheDocument()
    expect(screen.getByText("Clarifying questions allowed: 3")).toBeInTheDocument()
    expect(screen.getByText("Stage timer: 15:00")).toBeInTheDocument()
    expect(screen.getByText("Supervisor note")).toBeInTheDocument()
    expect(screen.getByText(/Leadership needs a scoped readout/i)).toBeInTheDocument()
  })
})
