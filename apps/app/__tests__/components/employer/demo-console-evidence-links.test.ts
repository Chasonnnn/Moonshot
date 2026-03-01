import { readFileSync } from "node:fs"

describe("demo console evidence links", () => {
  it("renders clickable evidence links for red-team and fairness runs", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/components/employer/demo-console.tsx",
      "utf-8",
    )

    expect(source).toContain("redteamEvidenceUrl")
    expect(source).toContain("fairnessEvidenceUrl")
    expect(source).toContain("href={redteamEvidenceUrl}")
    expect(source).toContain("href={fairnessEvidenceUrl}")
  })
})
