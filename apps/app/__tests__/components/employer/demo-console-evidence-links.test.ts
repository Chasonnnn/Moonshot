import { readFileSync } from "node:fs"

describe("demo console structure", () => {
  it("contains key demo flow phases and components", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/components/employer/demo-console.tsx",
      "utf-8",
    )

    expect(source).toContain("runDemoFastPath")
    expect(source).toContain("runDemoAutoComplete")
    expect(source).toContain("ReportReviewConsole")
    expect(source).toContain("DemoGeneratingAnimation")
    expect(source).toContain("DemoTemplateCard")
    expect(source).toContain("StepIndicator")
    expect(source).toContain("Start New Demo")
  })
})
