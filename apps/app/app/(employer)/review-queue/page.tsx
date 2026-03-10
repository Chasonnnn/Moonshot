import type { Metadata } from "next"

import { loadReviewQueueSnapshot } from "@/actions/review-queue"
import { ReviewQueueConsole } from "@/components/employer/review-queue-console"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Review Queue",
  description: "Resolve human review exceptions and audit notes for Moonshot employer operations.",
}

export default async function ReviewQueuePage() {
  const snapshot = await loadReviewQueueSnapshot()

  return (
    <div className="ops-page-wrap">
      <div className="mb-10">
        <p className="ops-eyebrow">Moonshot MVP · Employer Ops</p>
        <h1 className="ops-page-title">Review Queue</h1>
      </div>
      <ReviewQueueConsole snapshot={snapshot} />
    </div>
  )
}
