import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/actions/pilot", () => ({
  runDemoFastPath: vi.fn(),
  runDemoAutoComplete: vi.fn(),
}))

vi.mock("@/actions/reports", () => ({
  loadReportDetailSnapshot: vi.fn(),
}))

vi.mock("@/components/employer/report-review-console", () => ({
  ReportReviewConsole: () => <div data-testid="report-review-console" />,
}))

import { DemoConsole } from "@/components/employer/demo-console"

describe("DemoConsole template selection", () => {
  it("renders template cards and allows selection", async () => {
    render(
      <DemoConsole
        snapshot={{
          ok: true,
          apiVersion: "0.6.0",
          schemaVersion: "0.6.0",
          caseCount: 0,
          jobCount: 0,
          error: null,
        }}
      />,
    )

    expect(screen.getByText("KPI Discrepancy Investigation")).toBeTruthy()
    expect(screen.getByText("SQL Data Quality Triage")).toBeTruthy()
    expect(screen.getByText("Stakeholder Ambiguity Handling")).toBeTruthy()

    expect(screen.getByText("Start Demo")).toBeTruthy()
  })

  it("shows step indicator with Select Role active initially", () => {
    render(
      <DemoConsole
        snapshot={{
          ok: true,
          apiVersion: "0.6.0",
          schemaVersion: "0.6.0",
          caseCount: 0,
          jobCount: 0,
          error: null,
        }}
      />,
    )

    expect(screen.getByText("Select Role")).toBeTruthy()
    expect(screen.getByText("Generating")).toBeTruthy()
    expect(screen.getByText("Preview & Confirm")).toBeTruthy()
    expect(screen.getByText("Candidate Session")).toBeTruthy()
    expect(screen.getByText("Report")).toBeTruthy()
  })
})
