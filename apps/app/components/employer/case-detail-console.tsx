"use client"

import { useActionState } from "react"

import {
  generateCaseAction,
  type CaseActionState,
  publishTaskFamilyAction,
  reviewTaskFamilyAction,
  updateCaseAction,
} from "@/actions/cases"
import type { CaseSpec, TaskFamily } from "@/lib/moonshot/types"

const initialCaseActionState: CaseActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

export function CaseDetailConsole({ caseItem, taskFamilies }: { caseItem: CaseSpec; taskFamilies: TaskFamily[] }) {
  const [updateState, updateAction, isUpdating] = useActionState(updateCaseAction, initialCaseActionState)
  const [generateState, generateAction, isGenerating] = useActionState(generateCaseAction, initialCaseActionState)
  const [reviewState, reviewAction, isReviewing] = useActionState(reviewTaskFamilyAction, initialCaseActionState)
  const [publishState, publishAction, isPublishing] = useActionState(publishTaskFamilyAction, initialCaseActionState)

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Case Details</h2>
        <form action={updateAction} className="mt-4 grid gap-3">
          <input type="hidden" name="case_id" value={caseItem.id} />
          <input
            name="title"
            defaultValue={caseItem.title}
            className="rounded-lg border border-[#D2D2D7] px-3 py-2 text-[13px]"
            required
          />
          <textarea
            name="scenario"
            defaultValue={caseItem.scenario}
            className="min-h-28 rounded-lg border border-[#D2D2D7] px-3 py-2 text-[13px]"
            required
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isUpdating}
              className="rounded-full bg-[#1D1D1F] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
            >
              {isUpdating ? "Saving..." : "Save Case"}
            </button>
            {updateState.error ? (
              <p className="text-[12px] text-[#D70015]">
                {updateState.error} {updateState.requestId ? `(request_id=${updateState.requestId})` : ""}
              </p>
            ) : null}
            {updateState.ok ? <p className="text-[12px] text-[#34C759]">{updateState.message}</p> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Generation</h2>
        <form action={generateAction} className="mt-4">
          <input type="hidden" name="case_id" value={caseItem.id} />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isGenerating}
              className="rounded-full bg-[#0071E3] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
            >
              {isGenerating ? "Submitting..." : "Generate Task Family"}
            </button>
            {generateState.error ? (
              <p className="text-[12px] text-[#D70015]">
                {generateState.error} {generateState.requestId ? `(request_id=${generateState.requestId})` : ""}
              </p>
            ) : null}
            {generateState.ok ? <p className="text-[12px] text-[#34C759]">{generateState.message}</p> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Task Families</h2>
        <div className="mt-4 space-y-3">
          {taskFamilies.map((family) => (
            <div key={family.id} className="rounded-xl border border-[#E5E5EA] px-4 py-3">
              <p className="text-[13px] font-medium text-[#1D1D1F]">task_family={family.id}</p>
              <p className="mt-1 text-[12px] text-[#6E6E73]">
                status={family.status} · variants={family.variants.length} · version={family.version}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={reviewAction}>
                  <input type="hidden" name="task_family_id" value={family.id} />
                  <button
                    type="submit"
                    disabled={isReviewing}
                    className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F] disabled:opacity-60"
                  >
                    {isReviewing ? "Approving..." : "Approve"}
                  </button>
                </form>
                <form action={publishAction}>
                  <input type="hidden" name="task_family_id" value={family.id} />
                  <button
                    type="submit"
                    disabled={isPublishing}
                    className="rounded-full bg-[#34C759] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
                  >
                    {isPublishing ? "Publishing..." : "Publish"}
                  </button>
                </form>
              </div>
            </div>
          ))}
          {taskFamilies.length === 0 ? <p className="text-[13px] text-[#6E6E73]">No task families yet.</p> : null}
        </div>
        {reviewState.error ? (
          <p className="mt-3 text-[12px] text-[#D70015]">
            {reviewState.error} {reviewState.requestId ? `(request_id=${reviewState.requestId})` : ""}
          </p>
        ) : null}
        {reviewState.ok ? <p className="mt-3 text-[12px] text-[#34C759]">{reviewState.message}</p> : null}
        {publishState.error ? (
          <p className="mt-3 text-[12px] text-[#D70015]">
            {publishState.error} {publishState.requestId ? `(request_id=${publishState.requestId})` : ""}
          </p>
        ) : null}
        {publishState.ok ? <p className="mt-3 text-[12px] text-[#34C759]">{publishState.message}</p> : null}
      </div>
    </section>
  )
}
