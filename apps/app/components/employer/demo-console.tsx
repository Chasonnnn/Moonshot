"use client"

import Link from "next/link"
import { useActionState, useMemo, useState } from "react"

import { runJdaDemoFlow } from "@/actions/pilot"
import { initialDemoRunState, type DemoSeedMode, type DemoRunState, type PilotSnapshot } from "@/lib/moonshot/pilot-flow"

function statusColor(ok: boolean): string {
  return ok ? "text-[#34C759]" : "text-[#D70015]"
}

export function DemoConsole({ snapshot }: { snapshot: PilotSnapshot }) {
  const [mode, setMode] = useState<DemoSeedMode>("both")
  const [state, formAction, isPending] = useActionState<DemoRunState, FormData>(runJdaDemoFlow, initialDemoRunState)

  const candidateUrl = useMemo(() => {
    if (!state.sessionId) {
      return null
    }
    return `/session/${state.sessionId}`
  }, [state.sessionId])

  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">Guided Demo Console</h2>
          <p className="mt-1 text-[13px] text-[#6E6E73]">
            Runs one guided flow: seed/generate → session handoff → score/export → fairness/red-team → governance checks.
          </p>
        </div>
        <form action={formAction} className="flex items-center gap-3">
          <input type="hidden" name="mode" value={mode} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-[#0071E3] px-4 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Running..." : "Run Guided Demo"}
          </button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-[#E5E5EA] p-3">
          <p className="text-[11px] text-[#6E6E73]">Backend Reachability</p>
          <p className="text-[14px] font-medium text-[#1D1D1F]">{snapshot.ok ? "Connected" : "Disconnected"}</p>
        </div>
        <div className="rounded-xl border border-[#E5E5EA] p-3">
          <p className="text-[11px] text-[#6E6E73]">API Version</p>
          <p className="text-[14px] font-medium text-[#1D1D1F]">{snapshot.apiVersion ?? "n/a"}</p>
        </div>
        <div className="rounded-xl border border-[#E5E5EA] p-3">
          <p className="text-[11px] text-[#6E6E73]">Cases in Tenant</p>
          <p className="text-[14px] font-medium text-[#1D1D1F]">{snapshot.caseCount}</p>
        </div>
        <div className="rounded-xl border border-[#E5E5EA] p-3">
          <p className="text-[11px] text-[#6E6E73]">Queued Jobs</p>
          <p className="text-[14px] font-medium text-[#1D1D1F]">{snapshot.jobCount}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-[#E5E5EA] p-4">
        <p className="mb-2 text-[12px] text-[#6E6E73]">Seed Mode</p>
        <div className="flex flex-wrap gap-2">
          {(["fixture", "fresh", "both"] as const).map((seedMode) => (
            <button
              key={seedMode}
              type="button"
              onClick={() => setMode(seedMode)}
              className={[
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                mode === seedMode ? "bg-[#1D1D1F] text-white" : "bg-[#F5F5F7] text-[#1D1D1F]",
              ].join(" ")}
            >
              {seedMode}
            </button>
          ))}
        </div>
      </div>

      {state.status !== "idle" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E5E5EA] p-4">
            <p className="mb-1 text-[12px] text-[#6E6E73]">Run status</p>
            <p className="text-[15px] font-medium text-[#1D1D1F]">{state.status === "success" ? "Completed" : "Failed"}</p>
            <p className="mt-2 text-[12px] text-[#6E6E73]">
              Tenant: {state.tenantId ?? "n/a"} · Session: {state.sessionId ?? "n/a"} · Export: {state.exportRunId ?? "n/a"}
            </p>
            {state.error ? <p className="mt-2 text-[12px] text-[#D70015]">{state.error}</p> : null}
          </div>

          <div className="rounded-xl border border-[#E5E5EA] p-4">
            <p className="mb-2 text-[12px] text-[#6E6E73]">Execution steps</p>
            <ul className="space-y-2">
              {state.steps.map((step) => (
                <li key={`${step.name}-${step.detail}`} className="flex items-start gap-2 text-[13px] text-[#1D1D1F]">
                  <span className={statusColor(step.ok)}>●</span>
                  <span>
                    <strong className="font-medium">{step.name}:</strong> {step.detail}
                    {step.requestId ? <span className="text-[#6E6E73]"> (request_id={step.requestId})</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#E5E5EA] p-4">
              <p className="mb-2 text-[12px] text-[#6E6E73]">Candidate Handoff</p>
              {candidateUrl ? (
                <div className="space-y-2">
                  <Link
                    href={candidateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-full bg-[#0071E3] px-3 py-1.5 text-[12px] font-medium text-white"
                  >
                    Open Candidate Session
                  </Link>
                  <p className="text-[12px] text-[#6E6E73]">{candidateUrl}</p>
                </div>
              ) : (
                <p className="text-[12px] text-[#D70015]">Session ID unavailable. Candidate handoff blocked.</p>
              )}
            </div>
            <div className="rounded-xl border border-[#E5E5EA] p-4">
              <p className="mb-2 text-[12px] text-[#6E6E73]">Safety Runs</p>
              <p className="text-[12px] text-[#1D1D1F]">Red-team job: {state.redteamJobId ?? "n/a"}</p>
              <p className="text-[12px] text-[#1D1D1F]">Red-team run: {state.redteamRunId ?? "n/a"}</p>
              <p className="text-[12px] text-[#1D1D1F]">Red-team request_id: {state.redteamRequestId ?? "n/a"}</p>
              <p className="text-[12px] text-[#1D1D1F]">Red-team findings: {state.redteamFindings ?? "n/a"}</p>
              <p className="text-[12px] text-[#1D1D1F]">Fairness job: {state.fairnessJobId ?? "n/a"}</p>
              <p className="text-[12px] text-[#1D1D1F]">Fairness run: {state.fairnessRunId ?? "n/a"}</p>
              <p className="text-[12px] text-[#1D1D1F]">Fairness request_id: {state.fairnessRequestId ?? "n/a"}</p>
              <p className="text-[12px] text-[#1D1D1F]">Fairness sample size: {state.fairnessSampleSize ?? "n/a"}</p>
              {state.redteamRunId ? (
                <div className="text-[12px] text-[#6E6E73]">
                  <p>evidence: /v1/redteam/runs/{state.redteamRunId}</p>
                  <Link href={`/reports/${state.sessionId}`} className="text-[#0071E3] underline">
                    Open Report Review
                  </Link>
                </div>
              ) : null}
              {state.fairnessRunId ? (
                <div className="text-[12px] text-[#6E6E73]">
                  <p>evidence: /v1/fairness/smoke-runs/{state.fairnessRunId}</p>
                  <Link href="/governance" className="text-[#0071E3] underline">
                    Open Governance
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5EA] p-4">
            <p className="mb-2 text-[12px] text-[#6E6E73]">Seed Manifest</p>
            {state.seedManifest ? (
              <ul className="space-y-1 text-[12px] text-[#1D1D1F]">
                {state.seedManifest.entries.map((entry) => (
                  <li key={`${entry.source}-${entry.caseId}`}>
                    {entry.source} · {entry.scenarioId} · case {entry.caseId}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#6E6E73]">No seeded scenarios yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-[#E5E5EA] p-4">
            <p className="mb-2 text-[12px] text-[#6E6E73]">Governance Checks</p>
            {state.governanceBundle ? (
              <ul className="space-y-1 text-[12px] text-[#1D1D1F]">
                {state.governanceBundle.checks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#6E6E73]">No governance checks recorded.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
