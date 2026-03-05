import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
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
  })

  it("renders task prompt when no parts", () => {
    render(<TaskPanel />)
    expect(screen.getByText("Analyze the data")).toBeInTheDocument()
  })

  it("renders part navigation when parts exist", () => {
    defaultContext.parts = [
      { id: "p1", title: "Data Exploration", description: "Explore the dataset" },
      { id: "p2", title: "Report Writing", description: "Write your report" },
    ] as any
    render(<TaskPanel />)
    expect(screen.getByText("Data Exploration")).toBeInTheDocument()
    expect(screen.getByText("Report Writing")).toBeInTheDocument()
  })

  it("shows active part description", () => {
    defaultContext.parts = [
      { id: "p1", title: "Data Exploration", description: "Explore the dataset" },
      { id: "p2", title: "Report Writing", description: "Write your report" },
    ] as any
    defaultContext.activePart = 0
    render(<TaskPanel />)
    expect(screen.getByText("Explore the dataset")).toBeInTheDocument()
  })
})
