import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

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

    expect(screen.getByText("Processing (2)")).toBeInTheDocument()
    expect(screen.queryByText("Ready")).not.toBeInTheDocument()
  })

  it("shows ready indicator when there are no in-flight jobs", () => {
    render(
      <EmployerShell jobCount={0}>
        <div>content</div>
      </EmployerShell>,
    )

    expect(screen.getByText("Ready")).toBeInTheDocument()
    expect(screen.queryByText(/Processing/)).not.toBeInTheDocument()
  })

  it("marks parent nav item active for child routes", () => {
    mockedPathname = "/cases/case-123"

    render(
      <EmployerShell>
        <div>content</div>
      </EmployerShell>,
    )

    expect(screen.getByRole("link", { name: "Cases" }).className).toContain("bg-[#1D1D1F]")
  })
})
