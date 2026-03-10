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

  it("contains an 8-round fixture program (2 per week x 4 weeks)", () => {
    const fixture = DEMO_FIXTURES.tpl_doordash_enablement
    expect(fixture).toBeDefined()
    expect(fixture.rounds).toHaveLength(8)
    expect(fixture.rounds[0]?.title).toContain("Week 1")
    expect(fixture.rounds[7]?.title).toContain("Week 4")
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

describe("Flagship analyst demo alignment", () => {
  it("keeps the analyst scenario as the default flagship entry", () => {
    const template = DEMO_CASE_TEMPLATES.find((item) => item.id === "tpl_data_analyst")
    expect(DEMO_CASE_TEMPLATES[0]?.id).toBe("tpl_data_analyst")
    expect(template?.priority).toBe("flagship")
    expect(template?.operatorLabel).toContain("Flagship")
  })

  it("keeps the analyst rounds and variant catalog ready for the main demo flow", () => {
    const fixture = DEMO_FIXTURES.tpl_data_analyst
    expect(fixture.rounds).toHaveLength(3)
    expect(fixture.variantCatalog.length).toBeGreaterThan(0)
    expect(fixture.evaluationBundle.coDesignAlignment.length).toBeGreaterThan(0)
  })
})

describe("Customer support judgment demo fixture alignment", () => {
  it("exposes the template in the demo template catalog", () => {
    const template = DEMO_CASE_TEMPLATES.find((item) => item.id === "tpl_customer_support_judgment")
    expect(template).toBeDefined()
    expect(template?.skills).toContain("policy")
    expect(template?.skills).toContain("escalation")
  })

  it("keeps rubric and score dimensions aligned", () => {
    const fixture = DEMO_FIXTURES.tpl_customer_support_judgment
    expect(fixture).toBeDefined()
    expect(fixture.rounds).toHaveLength(3)

    const rubricKeys = fixture.rubric.map((item) => item.key)
    const scoreKeys = Object.keys(fixture.mockScoreResult.dimensionScores)

    expect(rubricKeys).toEqual(
      expect.arrayContaining([
        "queue_prioritization",
        "policy_judgment",
        "escalation_quality",
        "customer_empathy",
        "written_clarity",
      ]),
    )
    expect(scoreKeys).toEqual(expect.arrayContaining(rubricKeys))
  })
})
