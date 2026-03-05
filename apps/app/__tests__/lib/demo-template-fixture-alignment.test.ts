import { describe, expect, it } from "vitest"

import { DEMO_CASE_TEMPLATES } from "@/lib/moonshot/demo-case-templates"
import { DEMO_FIXTURES } from "@/lib/moonshot/demo-fixtures"

describe("DoorDash enablement demo fixture alignment", () => {
  it("exposes the template in the demo template catalog", () => {
    const template = DEMO_CASE_TEMPLATES.find((item) => item.id === "tpl_doordash_enablement")
    expect(template).toBeDefined()
    expect(template?.skills).toContain("sql")
    expect(template?.skills).toContain("python")
    expect(template?.estimatedDuration).toBe("4 weeks")
  })

  it("contains a 4-round fixture program", () => {
    const fixture = DEMO_FIXTURES.tpl_doordash_enablement
    expect(fixture).toBeDefined()
    expect(fixture.rounds).toHaveLength(4)
    expect(fixture.rounds[0]?.title).toContain("Week 1")
    expect(fixture.rounds[3]?.title).toContain("Week 4")
  })

  it("keeps rubric and score dimensions aligned", () => {
    const fixture = DEMO_FIXTURES.tpl_doordash_enablement
    const rubricKeys = fixture.rubric.map((item) => item.key)
    const scoreKeys = Object.keys(fixture.mockScoreResult.dimensionScores)

    expect(rubricKeys).toEqual(
      expect.arrayContaining([
        "problem_framing",
        "analysis_correctness",
        "recommendation_quality",
        "tradeoff_roi_rigor",
        "communication_story",
        "sql_proficiency",
      ]),
    )
    expect(scoreKeys).toEqual(expect.arrayContaining(rubricKeys))
  })
})

