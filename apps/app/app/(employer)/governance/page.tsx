import type { Metadata } from "next"

import { loadGovernanceSnapshot } from "@/actions/governance"
import { GovernanceConsole } from "@/components/employer/governance-console"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Governance",
  description: "Review policy, audit, fairness, and red-team signals for Moonshot employer operations.",
}

export default async function GovernancePage() {
  const snapshot = await loadGovernanceSnapshot()

  return (
    <div className="ops-page-wrap">
      <div className="mb-10">
        <p className="ops-eyebrow">Moonshot MVP · Employer Ops</p>
        <h1 className="ops-page-title">Governance</h1>
      </div>
      <GovernanceConsole snapshot={snapshot} />
    </div>
  )
}
