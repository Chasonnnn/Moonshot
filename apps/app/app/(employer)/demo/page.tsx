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
    <div className="bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%)]">
      <div className="mx-auto max-w-screen-xl px-6 py-10 md:px-8 md:py-14">
        <div className="mb-10 rounded-[34px] border border-[#D7E0E4] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(247,243,234,0.88))] p-8 shadow-[0_30px_70px_rgba(15,46,61,0.10)]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2563EB]">Moonshot demo · Hybrid operator story</p>
          <h1 className="max-w-4xl text-[44px] font-semibold leading-[0.95] tracking-tight text-[#0F172A] md:text-[58px]">
            Show the room how a candidate thinks, verifies, and decides.
          </h1>
          <p className="mt-4 max-w-4xl text-[16px] leading-relaxed text-[#334155]">
            Lead with a clean analyst simulation, use one explicit live proof beat for credibility, and close on evaluation plus governance without pretending the product is more polished than it is.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              "Fixture-backed flagship path",
              "Explicit live proof step",
              "Report + governance payoff",
              "Breadth teaser after the win",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#DBEAFE] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1E3A8A]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <DemoConsole snapshot={snapshot} />
      </div>
    </div>
  )
}
