import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="area-chart" data-point-count={data.length}>{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

import { RoundPerformanceLine } from "@/components/employer/charts/round-performance-line"

describe("RoundPerformanceLine", () => {
  const rounds = [
    { round: "Round 1", score: 60, note: "Warming up" },
    { round: "Round 2", score: 70, note: "Getting better" },
    { round: "Round 3", score: 85, note: "Strong finish" },
  ]

  it("renders with round data", () => {
    render(<RoundPerformanceLine rounds={rounds} />)

    expect(screen.getByTestId("area-chart")).toBeInTheDocument()
    expect(screen.getByTestId("area-chart")).toHaveAttribute("data-point-count", "3")
  })

  it("renders the area element", () => {
    render(<RoundPerformanceLine rounds={rounds} />)

    expect(screen.getByTestId("area")).toBeInTheDocument()
  })

  it("renders empty state when no rounds", () => {
    render(<RoundPerformanceLine rounds={[]} />)

    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument()
    expect(screen.getByText(/no round data/i)).toBeInTheDocument()
  })
})
