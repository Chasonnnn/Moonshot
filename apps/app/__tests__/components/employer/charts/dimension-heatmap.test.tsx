import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-bar-count={data.length}>{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}))

import { DimensionHeatmap } from "@/components/employer/charts/dimension-heatmap"

describe("DimensionHeatmap", () => {
  const dimensions = [
    { dimension: "Problem Solving", score: 90, note: "Excellent" },
    { dimension: "Communication", score: 75, note: "Good" },
    { dimension: "Technical Skill", score: 60, note: "Adequate" },
    { dimension: "Business Acumen", score: 40, note: "Weak" },
  ]

  it("renders sorted bars (ascending by score)", () => {
    render(<DimensionHeatmap dimensions={dimensions} />)

    const chart = screen.getByTestId("bar-chart")
    expect(chart).toHaveAttribute("data-bar-count", "4")
  })

  it("renders the bar element", () => {
    render(<DimensionHeatmap dimensions={dimensions} />)

    expect(screen.getByTestId("bar")).toBeInTheDocument()
  })

  it("renders empty state when no dimensions", () => {
    render(<DimensionHeatmap dimensions={[]} />)

    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument()
    expect(screen.getByText(/no dimension data/i)).toBeInTheDocument()
  })
})
