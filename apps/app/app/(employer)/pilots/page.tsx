import { loadPilotSnapshot } from "@/actions/pilot"
import { PilotRunner } from "@/components/employer/pilot-runner"

export const dynamic = "force-dynamic"

export default async function PilotsPage() {
  const snapshot = await loadPilotSnapshot()

  return (
    <div className="max-w-screen-xl mx-auto px-8 py-14">
      <div className="mb-10">
        <p className="text-[13px] text-[#6E6E73] mb-1.5 tracking-tight">
          Moonshot MVP · JDA Integration
        </p>
        <h1 className="text-[40px] font-semibold text-[#1D1D1F] leading-none tracking-tight">
          Pilot Runs
        </h1>
      </div>
      <PilotRunner snapshot={snapshot} />
    </div>
  )
}
