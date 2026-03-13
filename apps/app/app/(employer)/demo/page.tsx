import type { Metadata } from "next"

import { loadPilotSnapshot } from "@/actions/pilot"
import { DemoConsole } from "@/components/employer/demo-console"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Sponsor Demo",
  description: "Sponsor-ready junior analyst work simulation with auditable evidence, staged workflow, and practice retry.",
}

export default async function DemoPage() {
  const snapshot = await loadPilotSnapshot()

  return (
    <div className="ops-app-shell overflow-x-clip">
      <div className="ops-page-wrap py-4 md:py-6">
        <div className="mb-4">
          <p className="ops-eyebrow text-[var(--ops-accent)]">Moonshot demo</p>
          <h1 className="ops-page-title mt-2">Sponsor-ready work simulation</h1>
          <p className="ops-page-copy mt-2 max-w-3xl">
            Lead with the junior analyst first-hour simulation, show the assessment evidence trail, and launch a practice retry from the same engine.
          </p>
        </div>
        <div className="ops-surface mb-4 flex flex-wrap items-center gap-2 px-4 py-3">
          <p className="ops-eyebrow text-[var(--ops-accent)]">Demo focus</p>
          <span className="text-[12px] text-[var(--ops-text-muted)]">One flagship JDA path first, customer support second skin next.</span>
          <span className="ops-pill ops-pill-accent text-[11px]">
            Dimension-first sponsor report
          </span>
          <span className="ops-pill ops-pill-accent text-[11px]">
            Practice retry on the same engine
          </span>
        </div>
        <DemoConsole snapshot={snapshot} />
      </div>
    </div>
  )
}
