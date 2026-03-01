"use client"

import { useActionState } from "react"

import {
  resolveReviewQueueAction,
  type ReviewQueueActionState,
  type ReviewQueueSnapshot,
} from "@/actions/review-queue"

const initialReviewQueueActionState: ReviewQueueActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

export function ReviewQueueConsole({ snapshot }: { snapshot: ReviewQueueSnapshot }) {
  const [state, formAction, isPending] = useActionState(resolveReviewQueueAction, initialReviewQueueActionState)

  if (snapshot.error) {
    return (
      <section className="rounded-2xl border border-[#FF9F0A] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Review Queue Unavailable</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">{snapshot.error}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
      <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Open Review Items</h2>
      <div className="mt-4 space-y-3">
        {snapshot.items.map((item) => (
          <div key={item.session_id} className="rounded-xl border border-[#E5E5EA] px-4 py-3">
            <p className="text-[13px] font-medium text-[#1D1D1F]">session={item.session_id}</p>
            <p className="mt-1 text-[12px] text-[#6E6E73]">
              reason={item.reason} · status={item.status} · created_by={item.created_by}
            </p>
            <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="session_id" value={item.session_id} />
              <select
                name="decision"
                defaultValue="approved"
                className="rounded-lg border border-[#D2D2D7] px-2 py-1.5 text-[12px]"
              >
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
              <input
                name="reviewer_note"
                placeholder="Reviewer note"
                className="rounded-lg border border-[#D2D2D7] px-2 py-1.5 text-[12px]"
              />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-full bg-[#1D1D1F] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
              >
                {isPending ? "Resolving..." : "Resolve"}
              </button>
            </form>
          </div>
        ))}
        {snapshot.items.length === 0 ? <p className="text-[13px] text-[#6E6E73]">No open review items.</p> : null}
      </div>
      {state.error ? (
        <p className="mt-3 text-[12px] text-[#D70015]">
          {state.error} {state.requestId ? `(request_id=${state.requestId})` : ""}
        </p>
      ) : null}
      {state.ok ? <p className="mt-3 text-[12px] text-[#34C759]">{state.message}</p> : null}
    </section>
  )
}
