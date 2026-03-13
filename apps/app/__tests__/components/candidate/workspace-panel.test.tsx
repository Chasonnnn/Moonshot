import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { WorkspacePanel } from "@/components/candidate/workspace-panel"

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({
    children,
    className,
  }: React.HTMLAttributes<HTMLDivElement> & { onValueChange?: (value: string) => void; value?: string }) => (
    <div className={className}>{children}</div>
  ),
  TabsList: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  TabsTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  TabsContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock("@/components/candidate/data-workspace", () => ({
  DataWorkspace: ({ datasets }: { datasets: Array<{ name: string }> }) => (
    <div data-testid="data-workspace">{datasets.map((dataset) => dataset.name).join(", ") || "no datasets"}</div>
  ),
}))
vi.mock("@/components/candidate/sql-workspace", () => ({
  SqlWorkspace: () => <div>sql-workspace</div>,
}))
vi.mock("@/components/candidate/python-workspace", () => ({
  AnalysisWorkspace: () => <div>analysis-workspace</div>,
}))
vi.mock("@/components/candidate/dashboard-workspace", () => ({
  DashboardWorkspace: () => <div>dashboard-workspace</div>,
}))
vi.mock("@/components/candidate/editor-workspace", () => ({
  EditorWorkspace: () => <div>editor-workspace</div>,
}))
vi.mock("@/components/candidate/spreadsheet-workspace", () => ({
  SpreadsheetWorkspace: () => <div>spreadsheet-workspace</div>,
}))
vi.mock("@/components/candidate/bi-workspace", () => ({
  BIWorkspace: () => <div>bi-workspace</div>,
}))
vi.mock("@/components/candidate/slides-workspace", () => ({
  SlidesWorkspace: () => <div>slides-workspace</div>,
}))
vi.mock("@/components/candidate/oral-workspace", () => ({
  OralWorkspace: () => <div>oral-workspace</div>,
}))

const mockApi = {
  getDatasets: vi.fn(),
  getDatasetPreview: vi.fn(),
}

let mockWorkspaceAvailability = {
  spreadsheet: false,
  bi: false,
  slides: false,
  oral: false,
}
let mockFixtureData = { datasets: [] as Array<Record<string, unknown>> }
let mockParts: Array<{ id: string }> = []
let mockActivePart = 0

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    api: mockApi,
    fixtureData: mockFixtureData,
    workspaceAvailability: mockWorkspaceAvailability,
    activeWorkspace: "data",
    setActiveWorkspace: vi.fn(),
    parts: mockParts,
    activePart: mockActivePart,
  }),
}))

describe("WorkspacePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceAvailability = {
      spreadsheet: false,
      bi: false,
      slides: false,
      oral: false,
    }
    mockFixtureData = { datasets: [] }
    mockParts = []
    mockActivePart = 0
    mockApi.getDatasets.mockResolvedValue({ datasets: [] })
    mockApi.getDatasetPreview.mockResolvedValue({ columns: [], rows: [] })
  })

  it("renders only base tabs when no extra workspace modes are available", async () => {
    render(<WorkspacePanel />)

    await waitFor(() => {
      expect(screen.getByText("Data")).toBeInTheDocument()
    })

    expect(screen.getByText("SQL")).toBeInTheDocument()
    expect(screen.getByText("Analysis")).toBeInTheDocument()
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Report")).toBeInTheDocument()
    expect(screen.queryByText("Spreadsheet")).not.toBeInTheDocument()
    expect(screen.queryByText("BI")).not.toBeInTheDocument()
    expect(screen.queryByText("Slides")).not.toBeInTheDocument()
    expect(screen.queryByText("Oral")).not.toBeInTheDocument()
  })

  it("renders Spreadsheet, BI, Slides, and Oral tabs when workspace availability enables them", async () => {
    mockWorkspaceAvailability = {
      spreadsheet: true,
      bi: true,
      slides: true,
      oral: true,
    }

    render(<WorkspacePanel />)

    await waitFor(() => {
      expect(screen.getByText("Spreadsheet")).toBeInTheDocument()
    })

    expect(screen.getByText("BI")).toBeInTheDocument()
    expect(screen.getByText("Slides")).toBeInTheDocument()
    expect(screen.getByText("Oral")).toBeInTheDocument()
  })

  it("renders a focusable tab strip for horizontal scrolling", async () => {
    render(<WorkspacePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText("Workspace tools")).toBeInTheDocument()
    })

    expect(screen.getByLabelText("Workspace tools")).toHaveAttribute("tabindex", "0")
    expect(screen.getByLabelText("Workspace tools").className).toContain("h-11")
    expect(screen.getByRole("button", { name: "Data" }).className).toContain("min-h-11")
  })

  it("hides gated datasets until the unlock stage is active", async () => {
    mockFixtureData = {
      datasets: [
        {
          id: "dataset_open",
          name: "campaign_performance_snapshot.csv",
          description: "Initial export",
          row_count: 4,
          schema: { columns: [] },
          preview_rows: [{ campaign: "A" }],
        },
        {
          id: "dataset_corrected",
          name: "campaign_performance_corrected.csv",
          description: "Corrected export",
          row_count: 4,
          schema: { columns: [] },
          preview_rows: [{ campaign: "A" }],
          available_from_part_id: "stage_analysis",
        },
      ],
    }
    mockParts = [{ id: "stage_triage" }, { id: "stage_analysis" }]
    mockActivePart = 0
    mockApi.getDatasets.mockResolvedValue({
      datasets: [
        {
          id: "dataset_open",
          name: "campaign_performance_snapshot.csv",
          description: "Initial export",
          row_count: 4,
          schema: { columns: [] },
          preview_rows: [{ campaign: "A" }],
        },
        {
          id: "dataset_corrected",
          name: "campaign_performance_corrected.csv",
          description: "Corrected export",
          row_count: 4,
          schema: { columns: [] },
          preview_rows: [{ campaign: "A" }],
        },
      ],
    })

    const { rerender } = render(<WorkspacePanel />)

    await waitFor(() => {
      expect(screen.getByTestId("data-workspace")).toHaveTextContent("campaign_performance_snapshot.csv")
    })
    expect(screen.getByTestId("data-workspace")).not.toHaveTextContent("campaign_performance_corrected.csv")

    mockActivePart = 1
    rerender(<WorkspacePanel />)

    await waitFor(() => {
      expect(screen.getByTestId("data-workspace")).toHaveTextContent("campaign_performance_corrected.csv")
    })
  })
})
