import { loadPilotSnapshot } from "@/actions/pilot"
import { DemoConsole } from "@/components/employer/demo-console"

export const dynamic = "force-dynamic"

export default async function DemoPage() {
  const snapshot = await loadPilotSnapshot()

  return (
    <div className="mx-auto max-w-screen-xl px-8 py-14">
      <div className="mb-10">
        <p className="mb-1.5 text-[13px] tracking-tight text-[#6E6E73]">Moonshot MVP · Guided Demo</p>
        <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[#1D1D1F]">Demo Console</h1>
      </div>
      <DemoConsole snapshot={snapshot} />
    </div>
  )
}
