import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CaseTemplates } from "@/components/employer/case-templates"

describe("CaseTemplates", () => {
  it("exposes the horizontal template gallery as a keyboard-reachable region", () => {
    render(<CaseTemplates onSelect={vi.fn()} />)

    const region = screen.getByRole("region", { name: /work simulation templates/i })
    expect(region).toHaveAttribute("tabindex", "0")
  })

  it("passes the selected template content to the caller", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(<CaseTemplates onSelect={onSelect} />)

    await user.click(screen.getByRole("button", { name: /kpi discrepancy investigation/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({
      title: "KPI Discrepancy Investigation",
    })
  })
})
