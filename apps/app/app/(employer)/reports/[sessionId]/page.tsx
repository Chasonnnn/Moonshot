import { loadReportDetailSnapshot } from "@/actions/reports"
import { ReportReviewConsole } from "@/components/employer/report-review-console"

export const dynamic = "force-dynamic"

export default async function ReportReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const snapshot = await loadReportDetailSnapshot(sessionId)

  return (
    <div className="mx-auto max-w-screen-xl px-8 py-14">
      <div className="mb-10">
        <p className="mb-1.5 text-[13px] tracking-tight text-[#6E6E73]">Moonshot MVP · Employer Ops</p>
        <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[#1D1D1F]">Report {sessionId}</h1>
      </div>
      <ReportReviewConsole sessionId={sessionId} snapshot={snapshot} />
    </div>
  )
}
