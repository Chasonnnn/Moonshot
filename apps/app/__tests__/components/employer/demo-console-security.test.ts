import { readFileSync } from "node:fs"

describe("demo console iframe security and autoplay validation", () => {
  it("validates postMessage origin/payload and removes the noisy sandbox pairing", () => {
    const source = readFileSync(
      "/Users/chason/Moonshot/apps/app/components/employer/demo-console.tsx",
      "utf-8",
    )

    expect(source).toContain("event.origin !== window.location.origin")
    expect(source).toContain("moonshot.autoplay_complete")
    expect(source).toContain("payload.sessionId !== sessionId")
    expect(source).not.toContain('sandbox="allow-scripts allow-same-origin allow-forms"')
    expect(source).toContain("Open in New Tab")
  })
})
