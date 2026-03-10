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
    <div className="ops-app-shell">
      <div className="ops-page-wrap px-6 py-10 md:py-14">
        <div className="ops-hero-surface mb-10 p-8">
          <p className="ops-eyebrow text-[var(--ops-success)]">Moonshot report · Trust payoff</p>
          <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[var(--ops-text)] md:text-[52px]">Employer Review Report</h1>
          <p className="mt-4 max-w-4xl text-[15px] leading-relaxed text-[var(--ops-text-muted)]">
            Review the candidate&apos;s recommendation, evidence trail, trigger rationale, and governance context for session{" "}
            <span className="font-mono text-[13px]">{sessionId}</span>.
          </p>
        </div>
        <ReportReviewConsole sessionId={sessionId} snapshot={snapshot} />
      </div>
    </div>
  )
}
