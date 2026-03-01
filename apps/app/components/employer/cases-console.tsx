"use client"

import Link from "next/link"
import { useActionState } from "react"
import { FolderOpenIcon } from "lucide-react"

import { createCaseAction, type CaseActionState, type CasesSnapshot } from "@/actions/cases"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

const initialCaseActionState: CaseActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

export function CasesConsole({ snapshot }: { snapshot: CasesSnapshot }) {
  const [state, formAction, isPending] = useActionState(createCaseAction, initialCaseActionState)
  useActionStateToast(state)

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Create Case</h2>
        <form action={formAction} className="mt-4 grid gap-3">
          <input
            name="title"
            placeholder="Case title"
            className="rounded-lg border border-[#D2D2D7] px-3 py-2 text-[13px]"
            required
          />
          <textarea
            name="scenario"
            placeholder="Scenario description"
            className="min-h-24 rounded-lg border border-[#D2D2D7] px-3 py-2 text-[13px]"
            required
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[#0071E3] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
            >
              {isPending ? "Creating..." : "Create Case"}
            </button>
          </div>
        </form>
      </div>

      {snapshot.error ? (
        <div className="rounded-2xl border border-[#FF9F0A] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Cases Unavailable</h2>
          <p className="mt-2 text-[13px] text-[#6E6E73]">{snapshot.error}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Cases</h2>
          <p className="mt-1 text-[12px] text-[#6E6E73]">Task family counts are computed from live backend data.</p>
          <div className="mt-4 space-y-3">
            {snapshot.cases.map((item) => {
              const familyCount = snapshot.taskFamilies.filter((family) => family.case_id === item.id).length
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E5EA] px-4 py-3"
                >
                  <div>
                    <p className="text-[13px] font-medium text-[#1D1D1F]">{item.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">{item.status}</Badge>
                      <span className="text-[12px] text-[#6E6E73]">
                        {familyCount} task {familyCount === 1 ? "family" : "families"}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/cases/${item.id}`}
                    className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F]"
                  >
                    Open Case
                  </Link>
                </div>
              )
            })}
            {snapshot.cases.length === 0 ? (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FolderOpenIcon /></EmptyMedia>
                  <EmptyTitle>No cases yet</EmptyTitle>
                  <EmptyDescription>Create your first case above to get started.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
