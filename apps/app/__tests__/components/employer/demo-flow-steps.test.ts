import { readFileSync } from "node:fs"

describe("guided demo flow action", () => {
  it("includes required step labels and safety runs", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/actions/pilot.ts",
      "utf-8",
    )

    expect(source).toContain('toStep("health"')
    expect(source).toContain('toStep("seed_or_generate"')
    expect(source).toContain('toStep("review_publish"')
    expect(source).toContain('toStep("create_session"')
    expect(source).toContain('toStep("candidate_handoff"')
    expect(source).toContain('toStep("score"')
    expect(source).toContain('toStep("report_export"')
    expect(source).toContain('toStep("governance_checks"')
    expect(source).toContain('"redteam"')
    expect(source).toContain('"fairness"')
  })
})
