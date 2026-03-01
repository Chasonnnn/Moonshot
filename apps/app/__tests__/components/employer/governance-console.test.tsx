import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { GovernanceConsole } from "@/components/employer/governance-console"

vi.mock("@/actions/governance", () => ({
  purgeExpiredDryRunAction: vi.fn(),
}))

vi.mock("react", async () => {
  const actual = await vi.importActual("react")
  return {
    ...actual,
    useActionState: (_action: unknown, initialState: unknown) => [initialState, vi.fn(), false],
  }
})

describe("GovernanceConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("submits via form requestSubmit when confirm action is clicked", async () => {
    const user = userEvent.setup()
    const requestSubmitSpy = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => {})

    render(
      <GovernanceConsole
        snapshot={{
          policy: {
            tenant_id: "tenant_demo",
            raw_content_default_opt_in: false,
            default_retention_ttl_days: 30,
            max_retention_ttl_days: 90,
          },
          auditVerification: {
            valid: true,
            checked_entries: 12,
          },
          recentAuditLogs: [],
          redteamRuns: [],
          fairnessRuns: [],
          error: null,
        }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Run TTL Purge Dry-Run" }))
    await user.click(screen.getByRole("button", { name: "Run Dry-Run" }))

    expect(requestSubmitSpy).toHaveBeenCalledTimes(1)
    requestSubmitSpy.mockRestore()
  })
})
