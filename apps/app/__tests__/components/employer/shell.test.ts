import { readFileSync } from "node:fs"

describe("employer shell navigation", () => {
  it("uses implemented routes only with no dead links", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/components/employer/shell.tsx",
      "utf-8",
    )

    expect(source).toContain('href: "/dashboard"')
    expect(source).toContain('href: "/demo"')
    expect(source).toContain('href: "/cases"')
    expect(source).toContain('href: "/review-queue"')
    expect(source).toContain('href: "/governance"')
    expect(source).toContain('href: "/pilots"')
    expect(source).not.toContain("Coming soon")
  })
})
