import { describe, it, expect } from "vitest"

import {
  INTEGRITY_TIER_PRESETS,
  getVisibleEventTypes,
} from "@/lib/integrity-tiers"
import type { IntegrityTier } from "@/lib/integrity-tiers"

describe("integrity-tiers", () => {
  it("defines light, standard, and strict presets", () => {
    expect(INTEGRITY_TIER_PRESETS.light).toBeDefined()
    expect(INTEGRITY_TIER_PRESETS.standard).toBeDefined()
    expect(INTEGRITY_TIER_PRESETS.strict).toBeDefined()
  })

  it("each preset has label, description, and visibleEventTypes", () => {
    const tiers: IntegrityTier[] = ["light", "standard", "strict"]
    for (const tier of tiers) {
      const config = INTEGRITY_TIER_PRESETS[tier]
      expect(config.label).toBeTruthy()
      expect(config.description).toBeTruthy()
      expect(Array.isArray(config.visibleEventTypes)).toBe(true)
      expect(config.visibleEventTypes.length).toBeGreaterThan(0)
    }
  })

  it("getVisibleEventTypes returns only session lifecycle events for light", () => {
    const types = getVisibleEventTypes("light")
    expect(types).toContain("session_started")
    expect(types).toContain("session_submitted")
    expect(types).not.toContain("sql_query_run")
    expect(types).not.toContain("copilot_invoked")
    expect(types).not.toContain("tab_blur_detected")
  })

  it("getVisibleEventTypes returns lifecycle + tool + AI events for standard", () => {
    const types = getVisibleEventTypes("standard")
    expect(types).toContain("session_started")
    expect(types).toContain("session_submitted")
    expect(types).toContain("sql_query_run")
    expect(types).toContain("verification_step_completed")
    expect(types).toContain("copilot_invoked")
    expect(types).not.toContain("tab_blur_detected")
    expect(types).not.toContain("copy_paste_detected")
  })

  it("getVisibleEventTypes returns all event types for strict", () => {
    const types = getVisibleEventTypes("strict")
    expect(types).toContain("session_started")
    expect(types).toContain("session_submitted")
    expect(types).toContain("sql_query_run")
    expect(types).toContain("verification_step_completed")
    expect(types).toContain("copilot_invoked")
    expect(types).toContain("tab_blur_detected")
    expect(types).toContain("copy_paste_detected")
  })
})
