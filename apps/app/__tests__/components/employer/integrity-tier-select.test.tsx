import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IntegrityTierSelect } from "@/components/employer/integrity-tier-select"

describe("IntegrityTierSelect", () => {
  it("renders 3 tier options (Light, Standard, Strict)", () => {
    render(<IntegrityTierSelect value="standard" onChange={vi.fn()} />)

    expect(screen.getByText("Light")).toBeInTheDocument()
    expect(screen.getByText("Standard")).toBeInTheDocument()
    expect(screen.getByText("Strict")).toBeInTheDocument()
  })

  it("fires onChange when a different tier is selected", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<IntegrityTierSelect value="standard" onChange={onChange} />)

    const strictRadio = screen.getByRole("radio", { name: /strict/i })
    await user.click(strictRadio)

    expect(onChange).toHaveBeenCalledWith("strict")
  })
})
