import { loadReviewQueueSnapshot } from "@/actions/review-queue"
import { ReviewQueueConsole } from "@/components/employer/review-queue-console"

export const dynamic = "force-dynamic"

export default async function ReviewQueuePage() {
  const snapshot = await loadReviewQueueSnapshot()

  return (
    <div className="mx-auto max-w-screen-xl px-8 py-14">
      <div className="mb-10">
        <p className="mb-1.5 text-[13px] tracking-tight text-[#6E6E73]">Moonshot MVP · Employer Ops</p>
        <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[#1D1D1F]">Review Queue</h1>
      </div>
      <ReviewQueueConsole snapshot={snapshot} />
    </div>
  )
}
