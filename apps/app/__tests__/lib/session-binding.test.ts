import { afterEach, describe, expect, it, vi } from "vitest"

import { signSessionBinding, verifySessionBinding } from "@/lib/moonshot/session-binding"

describe("session-binding", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("signs and verifies a session binding", () => {
    vi.stubEnv("MOONSHOT_SESSION_BINDING_SECRET", "test-secret")
    const sessionId = "session-123"
    const signature = signSessionBinding(sessionId)
    expect(signature).toHaveLength(64)
    expect(verifySessionBinding(sessionId, signature)).toBe(true)
  })

  it("rejects mismatched session binding signatures", () => {
    vi.stubEnv("MOONSHOT_SESSION_BINDING_SECRET", "test-secret")
    const signature = signSessionBinding("session-123")
    expect(verifySessionBinding("session-999", signature)).toBe(false)
  })
})
