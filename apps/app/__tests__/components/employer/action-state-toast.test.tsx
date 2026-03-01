import { readFileSync } from "node:fs"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

import {
  formatActionErrorForToast,
  useActionStateToast,
  type ActionToastState,
} from "@/components/employer/action-state-toast"

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

function ToastHarness({ state }: { state: ActionToastState }) {
  useActionStateToast(state)
  return null
}

describe("action state toast", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("formats error with request id when provided", () => {
    expect(formatActionErrorForToast("forbidden", "req-123")).toBe("forbidden (request_id=req-123)")
  })

  it("keeps plain error when request id is absent", () => {
    expect(formatActionErrorForToast("forbidden", null)).toBe("forbidden")
  })

  it("emits request-id-aware toast errors", () => {
    const baseState: ActionToastState = {
      ok: false,
      message: "",
      error: null,
      requestId: null,
    }

    const { rerender } = render(<ToastHarness state={baseState} />)

    rerender(
      <ToastHarness
        state={{
          ok: false,
          message: "",
          error: "unauthorized",
          requestId: "req-999",
        }}
      />,
    )

    expect(toastError).toHaveBeenCalledWith("unauthorized (request_id=req-999)")
  })

  it("is used by all employer action consoles", () => {
    const files = [
      "/Users/chason/Moonshot/apps/app/components/employer/cases-console.tsx",
      "/Users/chason/Moonshot/apps/app/components/employer/case-detail-console.tsx",
      "/Users/chason/Moonshot/apps/app/components/employer/review-queue-console.tsx",
      "/Users/chason/Moonshot/apps/app/components/employer/governance-console.tsx",
      "/Users/chason/Moonshot/apps/app/components/employer/report-review-console.tsx",
    ]

    for (const filePath of files) {
      const source = readFileSync(filePath, "utf-8")
      expect(source).toContain("useActionStateToast(")
    }
  })
})
