import { readFileSync } from "node:fs"

describe("employer layout job count wiring", () => {
  it("loads pilot snapshot and passes in-flight job count to shell", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/app/(employer)/layout.tsx",
      "utf-8",
    )

    expect(source).toContain("loadPilotSnapshot")
    expect(source).toContain("jobCount={jobCount}")
  })
})
