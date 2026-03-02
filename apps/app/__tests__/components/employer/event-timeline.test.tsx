import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { EventTimeline } from "@/components/employer/event-timeline"
import type { SessionEvent } from "@/lib/moonshot/types"

const SESSION_START = "2026-03-01T10:00:00Z"

const MOCK_EVENTS: SessionEvent[] = [
  {
    event_type: "session_started",
    payload: { candidate_id: "cand_01" },
    timestamp: "2026-03-01T10:00:00Z",
  },
  {
    event_type: "sql_query_run",
    payload: { query: "SELECT * FROM users", row_count: 42 },
    timestamp: "2026-03-01T10:02:30Z",
  },
  {
    event_type: "copilot_invoked",
    payload: { prompt_tokens: 120 },
    timestamp: "2026-03-01T10:05:00Z",
  },
  {
    event_type: "tab_blur_detected",
    payload: { duration_ms: 3200 },
    timestamp: "2026-03-01T10:06:15Z",
  },
  {
    event_type: "copy_paste_detected",
    payload: { char_count: 84 },
    timestamp: "2026-03-01T10:08:00Z",
  },
  {
    event_type: "verification_step_completed",
    payload: { step: "schema_check" },
    timestamp: "2026-03-01T10:10:00Z",
  },
  {
    event_type: "session_submitted",
    payload: { final_response_length: 512 },
    timestamp: "2026-03-01T10:12:00Z",
  },
]

describe("EventTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders events chronologically", () => {
    render(
      <EventTimeline events={MOCK_EVENTS} sessionStartedAt={SESSION_START} />
    )

    const badges = screen.getAllByTestId("event-badge")
    expect(badges).toHaveLength(7)

    expect(badges[0]).toHaveTextContent("session_started")
    expect(badges[1]).toHaveTextContent("sql_query_run")
    expect(badges[2]).toHaveTextContent("copilot_invoked")
    expect(badges[3]).toHaveTextContent("tab_blur_detected")
    expect(badges[4]).toHaveTextContent("copy_paste_detected")
    expect(badges[5]).toHaveTextContent("verification_step_completed")
    expect(badges[6]).toHaveTextContent("session_submitted")
  })

  it("color-codes badges by event type category", () => {
    render(
      <EventTimeline events={MOCK_EVENTS} sessionStartedAt={SESSION_START} />
    )

    const badges = screen.getAllByTestId("event-badge")

    // Blue lifecycle: session_started, session_submitted
    expect(badges[0]).toHaveStyle({ backgroundColor: "#0071E3" })
    expect(badges[6]).toHaveStyle({ backgroundColor: "#0071E3" })

    // Gray tool: sql_query_run, verification_step_completed
    expect(badges[1]).toHaveStyle({ backgroundColor: "#86868B" })
    expect(badges[5]).toHaveStyle({ backgroundColor: "#86868B" })

    // Purple AI: copilot_invoked
    expect(badges[2]).toHaveStyle({ backgroundColor: "#AF52DE" })

    // Amber integrity: tab_blur_detected, copy_paste_detected
    expect(badges[3]).toHaveStyle({ backgroundColor: "#FF9F0A" })
    expect(badges[4]).toHaveStyle({ backgroundColor: "#FF9F0A" })
  })

  it("filters events by category when checkboxes are toggled", async () => {
    const user = userEvent.setup()

    render(
      <EventTimeline events={MOCK_EVENTS} sessionStartedAt={SESSION_START} />
    )

    // All 7 events visible initially
    expect(screen.getAllByTestId("event-badge")).toHaveLength(7)

    // Uncheck "Integrity" category
    const integrityCheckbox = screen.getByRole("checkbox", {
      name: /integrity/i,
    })
    await user.click(integrityCheckbox)

    // Should hide tab_blur_detected and copy_paste_detected (2 events)
    expect(screen.getAllByTestId("event-badge")).toHaveLength(5)

    // Re-check "Integrity"
    await user.click(integrityCheckbox)
    expect(screen.getAllByTestId("event-badge")).toHaveLength(7)

    // Uncheck "AI" category
    const aiCheckbox = screen.getByRole("checkbox", { name: /ai/i })
    await user.click(aiCheckbox)

    // Should hide copilot_invoked (1 event)
    expect(screen.getAllByTestId("event-badge")).toHaveLength(6)
  })

  it("shows summary counts for total, integrity flags, and AI usage", () => {
    render(
      <EventTimeline events={MOCK_EVENTS} sessionStartedAt={SESSION_START} />
    )

    expect(screen.getByTestId("total-count")).toHaveTextContent("7")
    expect(screen.getByTestId("integrity-count")).toHaveTextContent("2")
    expect(screen.getByTestId("ai-count")).toHaveTextContent("1")
  })

  it("shows empty state when there are no events", () => {
    render(<EventTimeline events={[]} sessionStartedAt={SESSION_START} />)

    expect(screen.getByText(/no events/i)).toBeInTheDocument()
    expect(screen.queryAllByTestId("event-badge")).toHaveLength(0)
  })
})
