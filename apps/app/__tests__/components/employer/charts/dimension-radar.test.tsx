import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  RadarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="radar-chart" data-point-count={data.length}>{children}</div>
  ),
  Radar: ({ name }: { name: string }) => <div data-testid={`radar-${name}`} />,
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  Legend: () => null,
  Tooltip: () => null,
}))

import { DimensionRadar } from "@/components/employer/charts/dimension-radar"

describe("DimensionRadar", () => {
  const dimensions = [
    { dimension: "Problem Solving", score: 90, note: "Excellent" },
    { dimension: "Communication", score: 75, note: "Good" },
    { dimension: "Technical Skill", score: 60, note: "Adequate" },
  ]

  it("renders correct number of radar data points", () => {
    render(<DimensionRadar dimensions={dimensions} />)

    expect(screen.getByTestId("radar-chart")).toHaveAttribute("data-point-count", "3")
  })

  it("renders score radar polygon", () => {
    render(<DimensionRadar dimensions={dimensions} />)

    expect(screen.getByTestId("radar-Score")).toBeInTheDocument()
  })

  it("renders alignment overlay when provided", () => {
    const alignment = [
      { dimension: "Problem Solving", score: 85, note: "" },
      { dimension: "Communication", score: 70, note: "" },
      { dimension: "Technical Skill", score: 65, note: "" },
    ]
    render(<DimensionRadar dimensions={dimensions} alignment={alignment} />)

    expect(screen.getByTestId("radar-Score")).toBeInTheDocument()
    expect(screen.getByTestId("radar-Alignment")).toBeInTheDocument()
  })

  it("does not render alignment radar when not provided", () => {
    render(<DimensionRadar dimensions={dimensions} />)

    expect(screen.queryByTestId("radar-Alignment")).not.toBeInTheDocument()
  })

  it("renders empty state when no dimensions", () => {
    render(<DimensionRadar dimensions={[]} />)

    expect(screen.queryByTestId("radar-chart")).not.toBeInTheDocument()
    expect(screen.getByText(/no dimension data/i)).toBeInTheDocument()
  })
})
