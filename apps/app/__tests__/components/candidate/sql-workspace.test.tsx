import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SqlWorkspace } from "@/components/candidate/sql-workspace"

// Mock resizable panels (uses ResizeObserver not available in jsdom)
vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}))

// Mock sheet (portal/dialog not available in jsdom)
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock the session context
const mockRunSql = vi.fn()
const mockGetSqlHistory = vi.fn()
const mockTrack = vi.fn()

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => ({
    api: {
      runSql: mockRunSql,
      getSqlHistory: mockGetSqlHistory,
    },
    isSubmitted: false,
    track: mockTrack,
  }),
}))

describe("SqlWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSqlHistory.mockResolvedValue({ items: [] })
  })

  it("renders textarea and Run button", () => {
    render(<SqlWorkspace />)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument()
  })

  it("shows empty state text initially", () => {
    render(<SqlWorkspace />)
    expect(screen.getByText(/run a query to see results/i)).toBeInTheDocument()
  })

  it("typing a query and clicking Run shows results table", async () => {
    mockRunSql.mockResolvedValueOnce({
      ok: true,
      row_count: 2,
      columns: ["id", "name"],
      rows: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
      runtime_ms: 42,
    })

    render(<SqlWorkspace />)
    const textarea = screen.getByRole("textbox")
    await userEvent.type(textarea, "SELECT * FROM users")

    fireEvent.click(screen.getByRole("button", { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument()
      expect(screen.getByText("Bob")).toBeInTheDocument()
    })

    expect(mockTrack).toHaveBeenCalledWith(
      "sql_query_run",
      expect.objectContaining({ query_length: "SELECT * FROM users".length, row_count: 2, runtime_ms: 42 })
    )
    const runPayload = mockTrack.mock.calls.find(([eventType]) => eventType === "sql_query_run")?.[1]
    expect(runPayload).not.toHaveProperty("query")

    expect(screen.getByText(/2 rows/)).toBeInTheDocument()
    expect(screen.getByText(/42ms/)).toBeInTheDocument()
  })

  it("Cmd+Enter triggers run", async () => {
    mockRunSql.mockResolvedValueOnce({
      ok: true, row_count: 0, columns: [], rows: [], runtime_ms: 1,
    })

    render(<SqlWorkspace />)
    const textarea = screen.getByRole("textbox")
    await userEvent.type(textarea, "SELECT 1")

    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true })

    await waitFor(() => {
      expect(mockRunSql).toHaveBeenCalledWith("SELECT 1")
    })
  })

  it("SQL error shows Alert with error text", async () => {
    mockRunSql.mockResolvedValueOnce({
      ok: false, row_count: 0, columns: [], rows: [], runtime_ms: 0,
    })
    // The backend returns error in a different way - let's handle it as a rejected promise
    mockRunSql.mockReset()
    mockRunSql.mockRejectedValueOnce({
      message: "relation \"foo\" does not exist",
      status: 400,
    })

    render(<SqlWorkspace />)
    const textarea = screen.getByRole("textbox")
    await userEvent.type(textarea, "SELECT * FROM foo")
    fireEvent.click(screen.getByRole("button", { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText(/relation "foo" does not exist/)).toBeInTheDocument()
    })
    expect(mockTrack).toHaveBeenCalledWith(
      "sql_query_error",
      expect.objectContaining({ query_length: "SELECT * FROM foo".length, error_code: "unknown_error" })
    )
    const errorPayload = mockTrack.mock.calls.find(([eventType]) => eventType === "sql_query_error")?.[1]
    expect(errorPayload).not.toHaveProperty("error")
  })
})
