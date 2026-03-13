import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AnalysisWorkspace } from "@/components/candidate/python-workspace"

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockRunPython = vi.fn()
const mockGetPythonHistory = vi.fn()
const mockTrack = vi.fn()
const mockSetAnalysisReplayState = vi.fn()
let mockAutoPlay = false
let mockAnalysisReplayState = {
  language: "python" as const,
  code: "",
  result: null,
  error: null,
  pythonHistory: [],
  rHistory: [],
  isRunning: false,
  artifactRefs: [],
}

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    api: {
      runPython: mockRunPython,
      getPythonHistory: mockGetPythonHistory,
    },
    isSubmitted: false,
    isExpired: false,
    fixtureData: null,
    currentRoundIndex: 0,
    session: { policy: {} },
    parts: [],
    activePart: 0,
    autoPlay: mockAutoPlay,
    analysisReplayState: mockAnalysisReplayState,
    setAnalysisReplayState: mockSetAnalysisReplayState,
    track: mockTrack,
  }),
}))

describe("AnalysisWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAutoPlay = false
    mockAnalysisReplayState = {
      language: "python",
      code: "",
      result: null,
      error: null,
      pythonHistory: [],
      rHistory: [],
      isRunning: false,
      artifactRefs: [],
    }
    mockGetPythonHistory.mockResolvedValue({ items: [] })
    mockRunPython.mockResolvedValue({
      ok: true,
      stdout: "hello",
      stderr: null,
      plot_url: null,
      artifacts: [],
      runtime_ms: 12,
    })
  })

  it("renders Python and R mode toggles", () => {
    render(<AnalysisWorkspace />)
    expect(screen.getByRole("button", { name: "Python" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "R (Mock)" })).toBeInTheDocument()
  })

  it("renders replayed code and output during autoplay", () => {
    mockAutoPlay = true
    mockAnalysisReplayState = {
      language: "python",
      code: 'print("hello replay")',
      result: {
        ok: true,
        stdout: "hello replay",
        stderr: null,
        plot_url: null,
        artifacts: [],
        runtime_ms: 12,
        source: "python_api",
      },
      error: null,
      pythonHistory: [],
      rHistory: [],
      isRunning: false,
      artifactRefs: ["analysis_notes.md"],
    }

    render(<AnalysisWorkspace />)

    expect(screen.getByDisplayValue('print("hello replay")')).toBeInTheDocument()
    expect(screen.getByText("Replay input/output")).toBeInTheDocument()
    expect(screen.getByText("hello replay")).toBeInTheDocument()
  })

  it("runs R mock code and emits analysis_r_run telemetry", async () => {
    render(<AnalysisWorkspace />)
    await userEvent.click(screen.getByRole("button", { name: "R (Mock)" }))

    const textarea = screen.getByRole("textbox")
    await userEvent.type(textarea, "summary(df)")
    fireEvent.click(screen.getByRole("button", { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText(/R mode is mock and non-executing/i)).toBeInTheDocument()
      expect(mockTrack).toHaveBeenCalledWith(
        "analysis_r_run",
        expect.objectContaining({ source: "mock" }),
      )
    })
  })

  it("rejects unsafe R mock operations and emits analysis_r_error telemetry", async () => {
    render(<AnalysisWorkspace />)
    await userEvent.click(screen.getByRole("button", { name: "R (Mock)" }))

    const textarea = screen.getByRole("textbox")
    await userEvent.type(textarea, "system('ls')")
    fireEvent.click(screen.getByRole("button", { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText(/disallowed r operation/i)).toBeInTheDocument()
      expect(mockTrack).toHaveBeenCalledWith(
        "analysis_r_error",
        expect.objectContaining({ source: "mock" }),
      )
    })
  })
})
