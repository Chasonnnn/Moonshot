"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { FolderOpenIcon } from "lucide-react"

import { createCaseAction, type CaseActionState, type CasesSnapshot } from "@/actions/cases"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { CaseTemplates } from "@/components/employer/case-templates"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const initialCaseActionState: CaseActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

export function CasesConsole({ snapshot }: { snapshot: CasesSnapshot }) {
  const [state, formAction, isPending] = useActionState(createCaseAction, initialCaseActionState)
  useActionStateToast(state)

  const [title, setTitle] = useState("")
  const [scenario, setScenario] = useState("")

  return (
    <section className="space-y-6">
      <CaseTemplates onSelect={(tpl) => { setTitle(tpl.title); setScenario(tpl.scenario) }} />

      <div className="ops-surface p-6">
        <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Create Case</h2>
        <form action={formAction} className="mt-4 grid gap-3">
          <Input
            name="title"
            placeholder="Case title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-11 rounded-2xl border-[var(--ops-border-strong)] bg-white text-[13px]"
            required
          />
          <Textarea
            name="scenario"
            placeholder="Scenario description"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="min-h-32 rounded-3xl border-[var(--ops-border-strong)] bg-white px-4 py-3 text-[13px]"
            required
          />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={isPending}
              className="min-h-11 bg-[var(--ops-accent)] px-5 text-[13px] text-white hover:bg-[color-mix(in_srgb,var(--ops-accent)_84%,black)]"
            >
              {isPending ? "Creating..." : "Create Case"}
            </Button>
          </div>
        </form>
      </div>

      {snapshot.error ? (
        <div className="ops-surface p-6">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Cases Unavailable</h2>
          <p className="mt-2 text-[13px] text-[var(--ops-text-muted)]">{snapshot.error}</p>
        </div>
      ) : (
        <div className="ops-surface p-6">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Cases</h2>
          <p className="mt-1 text-[12px] text-[var(--ops-text-subtle)]">Task family counts are computed from live backend data.</p>
          <div className="mt-4 space-y-3">
            {snapshot.cases.map((item) => {
              const familyCount = snapshot.taskFamilies.filter((family) => family.case_id === item.id).length
              return (
                <div
                  key={item.id}
                  className="ops-surface-soft flex flex-wrap items-center justify-between gap-3 px-4 py-4"
                >
                  <div>
                    <p className="text-[13px] font-medium text-[var(--ops-text)]">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">{item.status}</Badge>
                      <span className="text-[12px] text-[var(--ops-text-subtle)]">
                        {familyCount} task {familyCount === 1 ? "family" : "families"}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/cases/${item.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "min-h-11 border-[var(--ops-border-strong)] bg-white px-4 text-[12px] text-[var(--ops-text)] hover:bg-[var(--ops-surface-muted)]"
                    )}
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
