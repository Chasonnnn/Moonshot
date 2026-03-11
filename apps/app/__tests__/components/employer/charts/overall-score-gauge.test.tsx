import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  RadialBarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="radial-bar-chart">{children}</div>,
  RadialBar: () => <div data-testid="radial-bar" />,
  PolarAngleAxis: () => null,
  Legend: () => null,
  Tooltip: () => null,
}))

import { OverallScoreGauge } from "@/components/employer/charts/overall-score-gauge"

describe("OverallScoreGauge", () => {
  it("renders with valid score and confidence", () => {
    render(<OverallScoreGauge score={78} confidence={0.87} />)

    expect(screen.getByText("78")).toBeInTheDocument()
    expect(screen.getByText("87% confidence")).toBeInTheDocument()
  })

  it("renders correct color class for high score (green >75)", () => {
    const { container } = render(<OverallScoreGauge score={85} confidence={0.9} />)

    expect(container.querySelector("[data-score-tier='high']")).toBeInTheDocument()
  })

  it("renders correct color class for medium score (amber 50-75)", () => {
    const { container } = render(<OverallScoreGauge score={60} confidence={0.7} />)

    expect(container.querySelector("[data-score-tier='medium']")).toBeInTheDocument()
  })

  it("renders correct color class for low score (red <50)", () => {
    const { container } = render(<OverallScoreGauge score={35} confidence={0.5} />)

    expect(container.querySelector("[data-score-tier='low']")).toBeInTheDocument()
  })

  it("handles null confidence gracefully", () => {
    render(<OverallScoreGauge score={70} confidence={null} />)

    expect(screen.getByText("70")).toBeInTheDocument()
    expect(screen.getByText("n/a confidence")).toBeInTheDocument()
  })

  it("renders the radial bar chart", () => {
    render(<OverallScoreGauge score={50} confidence={0.6} />)

    expect(screen.getByTestId("radial-bar-chart")).toBeInTheDocument()
  })

  it("hides the chart from assistive tech when the numeric score is already present in text", () => {
    render(<OverallScoreGauge score={50} confidence={0.6} />)

    expect(screen.getByTestId("responsive-container").closest("[aria-hidden='true']")).toBeInTheDocument()
  })
})
