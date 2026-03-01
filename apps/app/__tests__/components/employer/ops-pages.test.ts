import { readFileSync } from "node:fs"

describe("employer ops pages", () => {
  it("cases page loads from server action snapshot", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/app/(employer)/cases/page.tsx",
      "utf-8",
    )
    expect(source).toContain("loadCasesSnapshot")
    expect(source).toContain("CasesConsole")
  })

  it("review queue page loads live queue snapshot", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/app/(employer)/review-queue/page.tsx",
      "utf-8",
    )
    expect(source).toContain("loadReviewQueueSnapshot")
    expect(source).toContain("ReviewQueueConsole")
  })

  it("report page uses report detail snapshot and renders review console", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/app/(employer)/reports/[sessionId]/page.tsx",
      "utf-8",
    )
    expect(source).toContain("loadReportDetailSnapshot")
    expect(source).toContain("ReportReviewConsole")
  })

  it("governance page loads governance snapshot", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/app/(employer)/governance/page.tsx",
      "utf-8",
    )
    expect(source).toContain("loadGovernanceSnapshot")
    expect(source).toContain("GovernanceConsole")
  })
})
