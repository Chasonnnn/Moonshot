"use client"

import { useActionState } from "react"

import {
  purgeExpiredDryRunAction,
  type GovernanceActionState,
  type GovernanceSnapshot,
} from "@/actions/governance"

const initialGovernanceActionState: GovernanceActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

export function GovernanceConsole({ snapshot }: { snapshot: GovernanceSnapshot }) {
  const [state, formAction, isPending] = useActionState(purgeExpiredDryRunAction, initialGovernanceActionState)

  if (snapshot.error) {
    return (
      <section className="rounded-2xl border border-[#FF9F0A] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Governance Unavailable</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">{snapshot.error}</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Policy & Audit Integrity</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">
          raw_content_default_opt_in={String(snapshot.policy?.raw_content_default_opt_in ?? "n/a")} · default_ttl=
          {snapshot.policy?.default_retention_ttl_days ?? "n/a"} · max_ttl={snapshot.policy?.max_retention_ttl_days ?? "n/a"}
        </p>
        <p className="mt-1 text-[12px] text-[#6E6E73]">
          audit_chain_valid={String(snapshot.auditVerification?.valid ?? "n/a")} · checked_entries=
          {snapshot.auditVerification?.checked_entries ?? "n/a"}
        </p>
        <form action={formAction} className="mt-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-[#1D1D1F] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
          >
            {isPending ? "Running..." : "Run TTL Purge Dry-Run"}
          </button>
        </form>
        {state.error ? (
          <p className="mt-3 text-[12px] text-[#D70015]">
            {state.error} {state.requestId ? `(request_id=${state.requestId})` : ""}
          </p>
        ) : null}
        {state.ok ? <p className="mt-3 text-[12px] text-[#34C759]">{state.message}</p> : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Red-Team Runs</h2>
          <ul className="mt-3 space-y-2">
            {snapshot.redteamRuns.map((run) => (
              <li key={run.id} className="text-[12px] text-[#1D1D1F]">
                run={run.id} · status={run.status} · created_by={run.created_by ?? "n/a"}
              </li>
            ))}
            {snapshot.redteamRuns.length === 0 ? <li className="text-[12px] text-[#6E6E73]">No runs recorded.</li> : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Fairness Runs</h2>
          <ul className="mt-3 space-y-2">
            {snapshot.fairnessRuns.map((run) => (
              <li key={run.id} className="text-[12px] text-[#1D1D1F]">
                run={run.id} · status={run.status} · sample_size={String(run.summary["sample_size"] ?? "n/a")}
              </li>
            ))}
            {snapshot.fairnessRuns.length === 0 ? <li className="text-[12px] text-[#6E6E73]">No runs recorded.</li> : null}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Recent Audit Logs</h2>
        <ul className="mt-3 space-y-2">
          {snapshot.recentAuditLogs.map((item) => (
            <li key={item.id} className="text-[12px] text-[#1D1D1F]">
              {item.action} · {item.resource_type}:{item.resource_id}
              <span className="text-[#6E6E73]"> · actor={item.actor_role}</span>
            </li>
          ))}
          {snapshot.recentAuditLogs.length === 0 ? <li className="text-[12px] text-[#6E6E73]">No audit entries found.</li> : null}
        </ul>
      </div>
    </section>
  )
}
