import { readFileSync } from "node:fs"

describe("employer shell navigation", () => {
  it("uses implemented routes and marks others as coming soon", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/components/employer/shell.tsx",
      "utf-8",
    )

    expect(source).toContain('href: "/dashboard"')
    expect(source).toContain('href: "/demo"')
    expect(source).toContain('href: "/pilots"')

    expect(source).not.toContain('href: "/cases"')
    expect(source).not.toContain('href: "/task-families"')
    expect(source).not.toContain('href: "/exports"')
    expect(source).toContain("Coming soon")
  })
})
