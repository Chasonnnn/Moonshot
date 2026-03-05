import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/actions/pilot", () => ({
  loadLiveModelOptions: vi.fn(async () => ({
    options: [{ id: "anthropic/claude-opus-4-6", label: "anthropic/claude-opus-4-6" }],
    availableModelIds: ["anthropic/claude-opus-4-6"],
    defaultModelId: "anthropic/claude-opus-4-6",
    error: null,
  })),
  prepareDemoPreview: vi.fn(),
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

  it("renders fixture and live mode controls", () => {
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

    expect(screen.getByRole("button", { name: "Fixture" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Live (LiteLLM)" })).toBeTruthy()
  })

  it("shows operators panel in live mode", async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole("button", { name: "Live (LiteLLM)" }))
    expect(screen.getByText("Operators Panel")).toBeTruthy()
    expect(screen.getByText(/anthropic\/claude-opus-4-6/)).toBeTruthy()
    expect(screen.getByLabelText("Agent Profile")).toBeTruthy()
  })

  it("allows editing live co-design prompts with locked schema contract", async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole("button", { name: "Live (LiteLLM)" }))
    await user.click(screen.getByRole("button", { name: "Start Demo" }))

    await user.click(screen.getByText("Detailed Job Description"))
    const jdPrompt = screen.getByLabelText("Detailed Job Description") as HTMLTextAreaElement
    expect(jdPrompt.value.length).toBeGreaterThan(0)
    await user.clear(jdPrompt)
    await user.type(jdPrompt, "Custom live JD for anomaly triage and stakeholder reporting.")
    expect(jdPrompt.value).toContain("Custom live JD")

    await user.click(screen.getByText("Sample Tasks"))
    expect(screen.queryByLabelText("Detailed Job Description")).toBeNull()
    expect(screen.getByLabelText("Sample Tasks")).toBeTruthy()
    await user.click(screen.getByText("Rubric Blueprint"))
    expect(screen.getByLabelText("Rubric Blueprint")).toBeTruthy()
    await user.click(screen.getByText("Designed Incremental Difficulty Levels"))
    expect(screen.getByLabelText("Designed Incremental Difficulty Levels")).toBeTruthy()
    await user.click(screen.getByText("Agent Co-Design Notes"))
    expect(screen.getByLabelText("Agent Co-Design Notes")).toBeTruthy()
    expect(screen.getByText("Live Response Contract (Locked Schema)")).toBeTruthy()
  })
})
