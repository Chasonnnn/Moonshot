import { loadGovernanceSnapshot } from "@/actions/governance"
import { GovernanceConsole } from "@/components/employer/governance-console"

export const dynamic = "force-dynamic"

export default async function GovernancePage() {
  const snapshot = await loadGovernanceSnapshot()

  return (
    <div className="mx-auto max-w-screen-xl px-8 py-14">
      <div className="mb-10">
        <p className="mb-1.5 text-[13px] tracking-tight text-[#6E6E73]">Moonshot MVP · Employer Ops</p>
        <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[#1D1D1F]">Governance</h1>
      </div>
      <GovernanceConsole snapshot={snapshot} />
    </div>
  )
}
