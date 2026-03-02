import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")
  return {
    ...actual,
    useActionState: (_action: unknown, initialState: unknown) => [initialState, vi.fn(), false],
  }
})

vi.mock("@/actions/pilot", () => ({
  runJdaDemoFlow: vi.fn(),
}))

import { DemoConsole } from "@/components/employer/demo-console"

describe("DemoConsole assessment mode wiring", () => {
  it("writes selected assessment mode into form state payload", async () => {
    const user = userEvent.setup()
    const { container } = render(
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

    const hidden = container.querySelector<HTMLInputElement>('input[name="assessment_mode"]')
    expect(hidden).not.toBeNull()
    expect(hidden?.value).toBe("assessment")

    const modeCombobox = screen.getAllByRole("combobox")[1]
    await user.click(modeCombobox)
    await user.click(screen.getByText("No AI"))

    expect(hidden?.value).toBe("assessment_no_ai")
  })
})
