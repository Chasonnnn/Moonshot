"use client"

import { useActionState } from "react"
import { PackageIcon } from "lucide-react"

import {
  generateCaseAction,
  type CaseActionState,
  publishTaskFamilyAction,
  reviewTaskFamilyAction,
  updateCaseAction,
} from "@/actions/cases"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import type { CaseSpec, TaskFamily } from "@/lib/moonshot/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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

  useActionStateToast(updateState)
  useActionStateToast(generateState)
  useActionStateToast(reviewState)
  useActionStateToast(publishState)

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Case Details</h2>
        <form action={updateAction} className="mt-4 grid gap-3">
          <input type="hidden" name="case_id" value={caseItem.id} />
          <Input
            name="title"
            defaultValue={caseItem.title}
            className="rounded-lg text-[13px]"
            required
          />
          <Textarea
            name="scenario"
            defaultValue={caseItem.scenario}
            className="min-h-28 rounded-lg text-[13px]"
            required
          />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={isUpdating}
              variant="secondary"
              className="text-[13px]"
            >
              {isUpdating ? "Saving..." : "Save Case"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Generation</h2>
        <form action={generateAction} className="mt-4">
          <input type="hidden" name="case_id" value={caseItem.id} />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={isGenerating}
              className="text-[13px]"
            >
              {isGenerating ? "Submitting..." : "Generate Task Family"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Task Families</h2>
        <div className="mt-4 space-y-3">
          {taskFamilies.map((family) => (
            <div key={family.id} className="rounded-xl border border-[#E5E5EA] px-4 py-3">
              <p className="text-[13px] font-medium text-[#1D1D1F]">
                Task Family <code className="font-mono text-[12px]">{family.id.slice(0, 8)}</code>
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-[11px]">{family.status}</Badge>
                <span className="text-[12px] text-[#6E6E73]">
                  {family.variants.length} {family.variants.length === 1 ? "variant" : "variants"} · v{family.version}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={reviewAction}>
                  <input type="hidden" name="task_family_id" value={family.id} />
                  <Button
                    type="submit"
                    disabled={isReviewing}
                    variant="outline"
                    size="sm"
                    className="text-[12px]"
                  >
                    {isReviewing ? "Approving..." : "Approve"}
                  </Button>
                </form>
                <form action={publishAction}>
                  <input type="hidden" name="task_family_id" value={family.id} />
                  <Button
                    type="submit"
                    disabled={isPublishing}
                    size="sm"
                    className="bg-[#34C759] text-[12px] text-white hover:bg-[#2CB14D]"
                  >
                    {isPublishing ? "Publishing..." : "Publish"}
                  </Button>
                </form>
              </div>
            </div>
          ))}
          {taskFamilies.length === 0 ? (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><PackageIcon /></EmptyMedia>
                <EmptyTitle>No task families yet</EmptyTitle>
                <EmptyDescription>Generate a task family above to populate this section.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </div>
      </div>
    </section>
  )
}
