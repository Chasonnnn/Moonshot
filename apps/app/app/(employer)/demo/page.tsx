import type { Metadata } from "next"

import { loadPilotSnapshot } from "@/actions/pilot"
import { DemoConsole } from "@/components/employer/demo-console"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Work Simulation Demo",
  description: "Guided work simulations for analyst, strategy, and support hiring with reviewable evidence and governance traces.",
}

export default async function DemoPage() {
  const snapshot = await loadPilotSnapshot()

  return (
    <div className="ops-app-shell overflow-x-clip">
      <div className="ops-page-wrap py-4 md:py-6">
        <div className="mb-4">
          <p className="ops-eyebrow text-[var(--ops-accent)]">Moonshot demo</p>
          <h1 className="ops-page-title mt-2">Work simulation demo</h1>
          <p className="ops-page-copy mt-2 max-w-3xl">
            Run the flagship analyst story with visible evidence capture, an explicit live proof beat, and governance signals that survive review.
          </p>
        </div>
        <div className="ops-surface mb-4 flex flex-wrap items-center gap-2 px-4 py-3">
          <p className="ops-eyebrow text-[var(--ops-accent)]">Demo focus</p>
          <span className="text-[12px] text-[var(--ops-text-muted)]">Flagship analyst path first, breadth after the win.</span>
          <span className="ops-pill ops-pill-accent text-[11px]">
            Explicit live proof step
          </span>
          <span className="ops-pill ops-pill-accent text-[11px]">
            Breadth teaser after the win
          </span>
        </div>
        <DemoConsole snapshot={snapshot} />
      </div>
    </div>
  )
}
