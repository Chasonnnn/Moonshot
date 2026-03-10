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
    <div className="overflow-x-clip bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%)]">
      <div className="mx-auto max-w-screen-xl px-4 py-4 md:px-8 md:py-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-full border border-[#D7E0E4] bg-white/85 px-3 py-2 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2563EB]">Moonshot demo</p>
          <span className="text-[12px] text-[#475569]">Flagship analyst path first, breadth after the win.</span>
          <span className="rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-[11px] font-medium text-[#1E3A8A]">
            Explicit live proof step
          </span>
          <span className="rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-[11px] font-medium text-[#1E3A8A]">
            Breadth teaser after the win
          </span>
        </div>
        <DemoConsole snapshot={snapshot} />
      </div>
    </div>
  )
}
