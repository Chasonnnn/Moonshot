import { readFileSync } from "node:fs"

describe("pilot runner handoff", () => {
  it("includes candidate handoff CTA and copy-link utility", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/components/employer/pilot-runner.tsx",
      "utf-8",
    )

    expect(source).toContain("Open Candidate Session")
    expect(source).toContain("target=\"_blank\"")
    expect(source).toContain("Copy Link")
    expect(source).toContain("Session ID missing")
  })
})
