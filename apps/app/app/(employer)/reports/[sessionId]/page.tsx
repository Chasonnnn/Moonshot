import type { Metadata } from "next"

import { loadReportDetailSnapshot } from "@/actions/reports"
import { ReportReviewConsole } from "@/components/employer/report-review-console"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Employer Review Report",
  description: "Employer-facing work simulation report with approach narrative, rubric evidence, and governance trace.",
}

export default async function ReportReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const snapshot = await loadReportDetailSnapshot(sessionId)

  return (
    <div className="bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_24%)]">
      <div className="mx-auto max-w-screen-xl px-6 py-10 md:px-8 md:py-14">
        <div className="mb-10 rounded-[34px] border border-[#D7E0E4] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(247,243,234,0.88))] p-8 shadow-[0_24px_60px_rgba(15,46,61,0.08)]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#047857]">Moonshot report · Trust payoff</p>
          <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[#0F172A] md:text-[52px]">Employer Review Report</h1>
          <p className="mt-4 max-w-4xl text-[15px] leading-relaxed text-[#334155]">
            Review the candidate&apos;s recommendation, evidence trail, trigger rationale, and governance context for session{" "}
            <span className="font-mono text-[13px]">{sessionId}</span>.
          </p>
        </div>
        <ReportReviewConsole sessionId={sessionId} snapshot={snapshot} />
      </div>
    </div>
  )
}
