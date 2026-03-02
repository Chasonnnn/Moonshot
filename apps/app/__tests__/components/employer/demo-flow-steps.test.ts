import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("guided demo flow action", () => {
  it("includes required step labels and safety runs", () => {
    const source = readFileSync(resolve(process.cwd(), "actions/pilot.ts"), "utf-8")

    expect(source).toMatch(/toStep\(\s*"health"/)
    expect(source).toMatch(/toStep\(\s*"seed_or_generate"/)
    expect(source).toMatch(/toStep\(\s*"review_publish"/)
    expect(source).toMatch(/toStep\(\s*"create_session"/)
    expect(source).toMatch(/toStep\(\s*"candidate_handoff"/)
    expect(source).toMatch(/toStep\(\s*"score"/)
    expect(source).toMatch(/toStep\(\s*"report_export"/)
    expect(source).toMatch(/toStep\(\s*"governance_checks"/)
    expect(source).toContain('"redteam"')
    expect(source).toContain('"fairness"')
  })
})
