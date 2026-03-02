import { readFileSync } from "node:fs"

describe("dashboard page data integration", () => {
  it("loads live data from server fan-out action", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/app/(employer)/dashboard/page.tsx",
      "utf-8",
    )

    expect(source).toContain("loadDashboardSnapshot")
    expect(source).toContain("Active Cases")
    expect(source).toContain("Awaiting Review")
    expect(source).toContain("In-Flight Jobs")
    expect(source).toContain("/start")
    expect(source).not.toContain("Job #4812")
    expect(source).not.toContain("Customer Support Cohort A")
  })
})
