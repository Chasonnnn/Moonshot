import { loadCasesSnapshot } from "@/actions/cases"
import { CasesConsole } from "@/components/employer/cases-console"

export const dynamic = "force-dynamic"

export default async function CasesPage() {
  const snapshot = await loadCasesSnapshot()

  return (
    <div className="mx-auto max-w-screen-xl px-8 py-14">
      <div className="mb-10">
        <p className="mb-1.5 text-[13px] tracking-tight text-[#6E6E73]">Moonshot MVP · Employer Ops</p>
        <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[#1D1D1F]">Cases</h1>
      </div>
      <CasesConsole snapshot={snapshot} />
    </div>
  )
}
