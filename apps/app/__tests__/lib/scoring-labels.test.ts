import { describe, it, expect } from "vitest"

import { getScoringLabel } from "@/lib/scoring-labels"

describe("getScoringLabel", () => {
  it("returns amber AI-Assisted label for assessment_ai_assisted mode", () => {
    const result = getScoringLabel("assessment_ai_assisted")
    expect(result.label).toBe("AI-Assisted")
    expect(result.className).toContain("var(--ops-warning)")
    expect(result.warning).toBe("Not comparable to no-AI baselines")
  })

  it("returns green Clean Baseline label for assessment_no_ai mode", () => {
    const result = getScoringLabel("assessment_no_ai")
    expect(result.label).toBe("Clean Baseline")
    expect(result.className).toContain("var(--ops-success)")
    expect(result.warning).toBeNull()
  })

  it("returns gray Standard label for assessment mode", () => {
    const result = getScoringLabel("assessment")
    expect(result.label).toBe("Standard")
    expect(result.className).toContain("var(--ops-text-muted)")
    expect(result.warning).toBeNull()
  })

  it("returns gray Practice (unscored) label for practice mode", () => {
    const result = getScoringLabel("practice")
    expect(result.label).toBe("Practice (unscored)")
    expect(result.className).toContain("var(--ops-text-muted)")
    expect(result.warning).toBeNull()
  })

  it("returns gray Standard label when mode is undefined", () => {
    const result = getScoringLabel(undefined)
    expect(result.label).toBe("Standard")
    expect(result.className).toContain("var(--ops-text-muted)")
    expect(result.warning).toBeNull()
  })
})
