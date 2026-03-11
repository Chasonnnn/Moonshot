import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { EmployerShell } from "@/components/employer/shell"

let mockedPathname = "/dashboard"

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
}))

describe("EmployerShell behavior", () => {
  beforeEach(() => {
    mockedPathname = "/dashboard"
  })

  it("shows processing indicator when there are in-flight jobs", () => {
    render(
      <EmployerShell jobCount={2}>
        <div>content</div>
      </EmployerShell>,
    )

    expect(screen.getAllByText("Processing (2)").length).toBeGreaterThan(0)
    expect(screen.queryByText("Ready")).not.toBeInTheDocument()
  })

  it("shows ready indicator when there are no in-flight jobs", () => {
    render(
      <EmployerShell jobCount={0}>
        <div>content</div>
      </EmployerShell>,
    )

    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0)
    expect(screen.queryByText(/Processing/)).not.toBeInTheDocument()
  })

  it("wraps employer content in a main landmark", () => {
    render(
      <EmployerShell>
        <div>content</div>
      </EmployerShell>,
    )

    expect(screen.getByRole("main")).toContainElement(screen.getByText("content"))
  })

  it("marks parent nav item active for child routes", () => {
    mockedPathname = "/cases/case-123"

    render(
      <EmployerShell>
        <div>content</div>
      </EmployerShell>,
    )

    expect(screen.getByRole("link", { name: "Cases" }).className).toContain("bg-[var(--ops-text)]")
  })

  it("renders a compact mobile nav toggle and expands the panel on demand", async () => {
    const user = userEvent.setup()

    render(
      <EmployerShell>
        <div>content</div>
      </EmployerShell>,
    )

    const toggle = screen.getByTestId("mobile-nav-toggle")
    expect(toggle.className).toContain("h-11")
    expect(toggle.className).toContain("w-11")
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    await user.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getAllByRole("navigation", { hidden: true }).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole("link", { name: "Work Simulations" }).length).toBeGreaterThanOrEqual(1)
  })
})
