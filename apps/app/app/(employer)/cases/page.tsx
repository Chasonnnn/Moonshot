import type { Metadata } from "next"

import { loadCasesSnapshot } from "@/actions/cases"
import { CasesConsole } from "@/components/employer/cases-console"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Cases",
  description: "Create and review work simulation cases for Moonshot employer operations.",
}

export default async function CasesPage() {
  const snapshot = await loadCasesSnapshot()

  return (
    <div className="ops-page-wrap">
      <div className="mb-10">
        <p className="ops-eyebrow">Moonshot MVP · Employer Ops</p>
        <h1 className="ops-page-title">Cases</h1>
      </div>
      <CasesConsole snapshot={snapshot} />
    </div>
  )
}
