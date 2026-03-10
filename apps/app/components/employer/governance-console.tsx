"use client"

import { useActionState, useRef } from "react"
import { ShieldCheckIcon, FlaskConicalIcon } from "lucide-react"

import {
  purgeExpiredDryRunAction,
  type GovernanceActionState,
  type GovernanceSnapshot,
} from "@/actions/governance"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const initialGovernanceActionState: GovernanceActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

export function GovernanceConsole({ snapshot }: { snapshot: GovernanceSnapshot }) {
  const [state, formAction, isPending] = useActionState(purgeExpiredDryRunAction, initialGovernanceActionState)
  const formRef = useRef<HTMLFormElement>(null)
  useActionStateToast(state)

  if (snapshot.error) {
    return (
      <section className="ops-surface p-6">
        <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Governance Unavailable</h2>
        <p className="mt-2 text-[13px] text-[var(--ops-text-muted)]">{snapshot.error}</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="ops-surface p-6">
        <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Policy & Audit Integrity</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Content Opt-In</p>
            <p className="mt-0.5 text-[13px] text-[var(--ops-text)]">{String(snapshot.policy?.raw_content_default_opt_in ?? "n/a")}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Default TTL</p>
            <p className="mt-0.5 text-[13px] text-[var(--ops-text)]">{snapshot.policy?.default_retention_ttl_days ?? "n/a"} days</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Max TTL</p>
            <p className="mt-0.5 text-[13px] text-[var(--ops-text)]">{snapshot.policy?.max_retention_ttl_days ?? "n/a"} days</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">Audit Chain</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge
                variant={snapshot.auditVerification?.valid ? "secondary" : "outline"}
                className={
                  snapshot.auditVerification?.valid
                    ? "text-[11px]"
                    : "border-[var(--ops-danger)]/30 bg-[var(--ops-danger-soft)] text-[11px] text-[var(--ops-danger)]"
                }
              >
                {snapshot.auditVerification?.valid ? "Valid" : "Invalid"}
              </Badge>
              <span className="text-[12px] text-[var(--ops-text-subtle)]">
                {snapshot.auditVerification?.checked_entries ?? 0} entries
              </span>
            </div>
          </div>
        </div>
        <form ref={formRef} action={formAction} className="mt-4">
          <AlertDialog>
            <AlertDialogTrigger
              disabled={isPending}
              className="inline-flex min-h-11 items-center rounded-full bg-[var(--ops-text)] px-5 py-2.5 text-[13px] font-medium text-white disabled:opacity-60"
            >
              {isPending ? "Running..." : "Run TTL Purge Dry-Run"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Purge Dry-Run</AlertDialogTitle>
                <AlertDialogDescription>
                  This will simulate purging expired records. No data will be deleted during a dry run.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => formRef.current?.requestSubmit()}>
                  Run Dry-Run
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="ops-surface p-6">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Red-Team Runs</h2>
          <div className="mt-3 space-y-2">
            {snapshot.redteamRuns.map((run) => (
              <div key={run.id} className="ops-surface-soft flex items-center gap-2 px-3 py-3 text-[12px]">
                <Badge variant="outline" className="text-[11px]">{run.status}</Badge>
                <span className="font-mono text-[var(--ops-text)]">{run.id.slice(0, 8)}</span>
                <span className="text-[var(--ops-text-subtle)]">{run.created_by ?? "n/a"}</span>
              </div>
            ))}
            {snapshot.redteamRuns.length === 0 ? (
              <Empty className="py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><ShieldCheckIcon /></EmptyMedia>
                  <EmptyTitle>No red-team runs</EmptyTitle>
                  <EmptyDescription>Red-team runs will appear here once initiated.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </div>
        </div>
        <div className="ops-surface p-6">
          <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Fairness Runs</h2>
          <div className="mt-3 space-y-2">
            {snapshot.fairnessRuns.map((run) => (
              <div key={run.id} className="ops-surface-soft flex items-center gap-2 px-3 py-3 text-[12px]">
                <Badge variant="outline" className="text-[11px]">{run.status}</Badge>
                <span className="font-mono text-[var(--ops-text)]">{run.id.slice(0, 8)}</span>
                <span className="text-[var(--ops-text-subtle)]">Sample: {String(run.summary["sample_size"] ?? "n/a")}</span>
              </div>
            ))}
            {snapshot.fairnessRuns.length === 0 ? (
              <Empty className="py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FlaskConicalIcon /></EmptyMedia>
                  <EmptyTitle>No fairness runs</EmptyTitle>
                  <EmptyDescription>Fairness runs will appear here once initiated.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ops-surface p-6">
        <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Recent Audit Logs</h2>
        <div className="mt-3 space-y-2">
          {snapshot.recentAuditLogs.map((item) => (
            <div key={item.id} className="ops-surface-soft flex flex-wrap items-center gap-2 px-3 py-3 text-[12px]">
              <Badge variant="secondary" className="text-[11px]">{item.action}</Badge>
              <span className="text-[var(--ops-text)]">{item.resource_type}:{item.resource_id}</span>
              <span className="text-[var(--ops-text-subtle)]">{item.actor_role}</span>
            </div>
          ))}
          {snapshot.recentAuditLogs.length === 0 ? (
            <p className="text-[13px] text-[var(--ops-text-subtle)]">No audit entries found.</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
