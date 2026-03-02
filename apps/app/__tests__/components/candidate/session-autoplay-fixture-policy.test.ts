import { readFileSync } from "node:fs"

describe("candidate autoplay fixture policy binding", () => {
  it("requires session policy demo_template_id and does not fallback to default template", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/app/(candidate)/session/[id]/page.tsx",
      "utf-8",
    )

    expect(source).toContain("demo_template_id")
    expect(source).toContain("Demo Fixture Unavailable")
    expect(source).not.toContain("DEMO_CASE_TEMPLATES[0].id")
  })
})
