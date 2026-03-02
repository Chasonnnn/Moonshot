import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AssessmentModeSelect } from "@/components/employer/assessment-mode-select"

describe("AssessmentModeSelect", () => {
  it("renders all 4 mode options when opened", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<AssessmentModeSelect value="practice" onChange={onChange} />)

    const trigger = screen.getByRole("combobox")
    await user.click(trigger)

    expect(screen.getByText("Practice")).toBeInTheDocument()
    expect(screen.getByText("Assessment")).toBeInTheDocument()
    expect(screen.getByText("No AI")).toBeInTheDocument()
    expect(screen.getByText("AI-Assisted")).toBeInTheDocument()
  })

  it("fires onChange when an option is selected", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<AssessmentModeSelect value="practice" onChange={onChange} />)

    const trigger = screen.getByRole("combobox")
    await user.click(trigger)

    const assessmentOption = screen.getByText("Assessment")
    await user.click(assessmentOption)

    expect(onChange).toHaveBeenCalledWith("assessment")
  })
})
