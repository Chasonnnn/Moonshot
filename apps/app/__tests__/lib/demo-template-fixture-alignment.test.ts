import { describe, expect, it } from "vitest"

import { DEMO_CASE_TEMPLATES } from "@/lib/moonshot/demo-case-templates"
import { DEMO_FIXTURES, getRoundToolActions } from "@/lib/moonshot/demo-fixtures"

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
    expect(template?.requiresOralDefense).toBe(true)
    expect(template?.workspaceModes).toEqual(expect.arrayContaining(["oral"]))
  })

  it("keeps the analyst rounds and variant catalog ready for the main demo flow", () => {
    const fixture = DEMO_FIXTURES.tpl_data_analyst
    expect(fixture.rounds).toHaveLength(3)
    expect(fixture.variantCatalog.length).toBeGreaterThan(0)
    expect(fixture.evaluationBundle.coDesignAlignment.length).toBeGreaterThan(0)
  })

  it("derives normalized tool steps from legacy analyst round data", () => {
    const firstRoundTools = getRoundToolActions(DEMO_FIXTURES.tpl_data_analyst.rounds[0]!).map((action) => action.tool)

    expect(firstRoundTools).toEqual(expect.arrayContaining(["sql", "dashboard"]))
  })
})

describe("Expanded analytics simulations alignment", () => {
  it("exposes the revops and ops simulations in the template catalog", () => {
    const revopsTemplate = DEMO_CASE_TEMPLATES.find((item) => item.id === "tpl_revops_forecast_variance")
    const opsTemplate = DEMO_CASE_TEMPLATES.find((item) => item.id === "tpl_ops_capacity_escalation")

    expect(revopsTemplate).toBeDefined()
    expect(revopsTemplate?.workspaceModes).toEqual(expect.arrayContaining(["spreadsheet", "bi", "slides", "oral"]))
    expect(revopsTemplate?.requiresOralDefense).toBe(true)

    expect(opsTemplate).toBeDefined()
    expect(opsTemplate?.workspaceModes).toEqual(expect.arrayContaining(["spreadsheet", "bi", "slides"]))
  })

  it("backs the revops and ops simulations with executable round traces", () => {
    const revopsFixture = DEMO_FIXTURES.tpl_revops_forecast_variance
    const opsFixture = DEMO_FIXTURES.tpl_ops_capacity_escalation

    expect(revopsFixture.rounds).toHaveLength(3)
    expect(opsFixture.rounds).toHaveLength(3)

    expect(getRoundToolActions(revopsFixture.rounds[0]!).map((action) => action.tool)).toContain("spreadsheet")
    expect(getRoundToolActions(revopsFixture.rounds[1]!).map((action) => action.tool)).toContain("bi")
    expect(getRoundToolActions(revopsFixture.rounds[2]!).map((action) => action.tool)).toEqual(
      expect.arrayContaining(["slides", "oral"]),
    )

    expect(getRoundToolActions(opsFixture.rounds[0]!).map((action) => action.tool)).toContain("spreadsheet")
    expect(getRoundToolActions(opsFixture.rounds[1]!).map((action) => action.tool)).toContain("bi")
    expect(getRoundToolActions(opsFixture.rounds[2]!).map((action) => action.tool)).toContain("slides")
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

describe("Junior analyst demo oral-defense alignment", () => {
  it("marks the junior analyst templates as slide-plus-oral scenarios", () => {
    const qualityTemplate = DEMO_CASE_TEMPLATES.find((item) => item.id === "tpl_jda_quality")
    const ambiguityTemplate = DEMO_CASE_TEMPLATES.find((item) => item.id === "tpl_jda_ambiguity")

    expect(qualityTemplate?.requiresOralDefense).toBe(true)
    expect(qualityTemplate?.workspaceModes).toEqual(expect.arrayContaining(["slides", "oral"]))
    expect(ambiguityTemplate?.requiresOralDefense).toBe(true)
    expect(ambiguityTemplate?.workspaceModes).toEqual(expect.arrayContaining(["slides", "oral"]))
  })

  it("exposes normalized slide and oral tool traces in the final junior analyst rounds", () => {
    const qualityFinalRound = DEMO_FIXTURES.tpl_jda_quality.rounds.at(-1)
    const ambiguityFinalRound = DEMO_FIXTURES.tpl_jda_ambiguity.rounds.at(-1)

    expect(getRoundToolActions(qualityFinalRound!).map((action) => action.tool)).toEqual(
      expect.arrayContaining(["dashboard", "slides", "oral"]),
    )
    expect(getRoundToolActions(ambiguityFinalRound!).map((action) => action.tool)).toEqual(
      expect.arrayContaining(["dashboard", "slides", "oral"]),
    )
  })
})
