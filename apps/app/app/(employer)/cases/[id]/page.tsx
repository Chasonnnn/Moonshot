import Link from "next/link"

import { loadCaseDetail } from "@/actions/cases"
import { CaseDetailConsole } from "@/components/employer/case-detail-console"

export const dynamic = "force-dynamic"

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await loadCaseDetail(id)

  if (detail.error || detail.caseItem === null) {
    return (
      <div className="mx-auto max-w-screen-xl px-8 py-14">
        <div className="rounded-2xl border border-[#FF9F0A] bg-white p-8 shadow-sm">
          <h1 className="text-[24px] font-semibold text-[#1D1D1F]">Case Unavailable</h1>
          <p className="mt-2 text-[13px] text-[#6E6E73]">{detail.error ?? "Case not found"}</p>
          <Link href="/cases" className="mt-4 inline-flex rounded-full bg-[#F5F5F7] px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F]">
            Back to Cases
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-screen-xl px-8 py-14">
      <div className="mb-10">
        <p className="mb-1.5 text-[13px] tracking-tight text-[#6E6E73]">Moonshot MVP · Employer Ops</p>
        <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[#1D1D1F]">Case {detail.caseItem.id}</h1>
      </div>
      <CaseDetailConsole caseItem={detail.caseItem} taskFamilies={detail.taskFamilies} />
    </div>
  )
}
