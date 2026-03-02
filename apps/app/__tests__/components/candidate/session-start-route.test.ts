import { readFileSync } from "node:fs"

describe("candidate session start route", () => {
  it("bootstraps cookies in a route handler and redirects to session page", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/app/(candidate)/session/[id]/start/route.ts",
      "utf-8",
    )

    expect(source).toContain("NextResponse.redirect")
    expect(source).toContain("moonshot-session")
    expect(source).toContain("moonshot-session-id")
    expect(source).toContain("moonshot-session-sig")
    expect(source).toContain("moonshot-csrf")
    expect(source).toContain("`/session/${id}`")
    expect(source).toContain("requestUrl.searchParams.forEach")
  })
})
