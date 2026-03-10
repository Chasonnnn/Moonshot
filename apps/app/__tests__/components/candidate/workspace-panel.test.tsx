import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { WorkspacePanel } from "@/components/candidate/workspace-panel"

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  TabsList: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  TabsTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  TabsContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock("@/components/candidate/data-workspace", () => ({
  DataWorkspace: () => <div>data-workspace</div>,
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

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    api: mockApi,
    fixtureData: { datasets: [] },
    workspaceAvailability: mockWorkspaceAvailability,
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
  })
})
