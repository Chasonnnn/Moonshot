import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DataWorkspace } from "@/components/candidate/data-workspace"

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}))

const mockDatasets = [
  {
    id: "ds-1",
    name: "doordash_atl_restaurants",
    description: "Atlanta marketplace restaurant performance data",
    row_count: 100,
    schema: {
      columns: [
        { name: "restaurant_id", dtype: "string", description: "Unique restaurant identifier", sample_values: ["R001", "R002"] },
        { name: "weekly_page_views", dtype: "integer", description: "Weekly page views on DoorDash", sample_values: ["118", "310"] },
        { name: "conversion_rate", dtype: "float", description: "Conversion rate from views to orders", sample_values: ["0.14", "0.29"] },
      ],
    },
    preview_rows: [
      { restaurant_id: "R001", weekly_page_views: 118, conversion_rate: 0.14 },
      { restaurant_id: "R002", weekly_page_views: 310, conversion_rate: 0.29 },
    ],
  },
]

const mockGetDatasets = vi.fn()

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    api: {
      getDatasets: mockGetDatasets,
    },
  }),
}))

describe("DataWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDatasets.mockResolvedValue({ datasets: mockDatasets })
  })

  it("renders dataset name and description", async () => {
    render(<DataWorkspace datasets={mockDatasets} />)
    expect(screen.getByText("doordash_atl_restaurants")).toBeInTheDocument()
    expect(screen.getByText("Atlanta marketplace restaurant performance data")).toBeInTheDocument()
  })

  it("shows row count", () => {
    render(<DataWorkspace datasets={mockDatasets} />)
    expect(screen.getByText(/100 rows/)).toBeInTheDocument()
  })

  it("shows column schema with types", () => {
    render(<DataWorkspace datasets={mockDatasets} />)
    expect(screen.getAllByText("restaurant_id").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("string")).toBeInTheDocument()
    expect(screen.getAllByText("weekly_page_views").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("integer")).toBeInTheDocument()
  })

  it("renders preview table with rows", () => {
    render(<DataWorkspace datasets={mockDatasets} />)
    expect(screen.getByText("R001")).toBeInTheDocument()
    expect(screen.getByText("R002")).toBeInTheDocument()
  })

  it("shows empty state when no datasets", () => {
    render(<DataWorkspace datasets={[]} />)
    expect(screen.getByText(/no datasets available/i)).toBeInTheDocument()
  })

  it("shows column descriptions", () => {
    render(<DataWorkspace datasets={mockDatasets} />)
    expect(screen.getByText("Unique restaurant identifier")).toBeInTheDocument()
  })

  it("shows sample values for columns", () => {
    render(<DataWorkspace datasets={mockDatasets} />)
    expect(screen.getByText(/Sample: R001, R002/)).toBeInTheDocument()
  })
})
