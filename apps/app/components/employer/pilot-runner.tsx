"use client"

import { useActionState } from "react"

import { runJdaPilotFlow } from "@/actions/pilot"
import { initialPilotFlowState, type PilotSnapshot } from "@/lib/moonshot/pilot-flow"

export function PilotRunner({ snapshot }: { snapshot: PilotSnapshot }) {
  const [state, formAction, isPending] = useActionState(runJdaPilotFlow, initialPilotFlowState)

  return (
    <section className="bg-white rounded-2xl shadow-sm p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">JDA Integration Runner</h2>
          <p className="text-[13px] text-[#6E6E73] mt-1">
            Executes one full backend flow from case generation to export retrieval.
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-full bg-[#0071E3] text-white text-[13px] font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Running..." : "Run JDA Flow"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
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

      {snapshot.error ? (
        <div className="mb-6 rounded-xl border border-[#FF9F0A] bg-[#FF9F0A]/10 px-4 py-3 text-[13px] text-[#1D1D1F]">
          Snapshot error: {snapshot.error}
        </div>
      ) : null}

      {state.status !== "idle" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E5E5EA] p-4">
            <p className="text-[12px] text-[#6E6E73] mb-1">Run status</p>
            <p className="text-[15px] font-medium text-[#1D1D1F]">
              {state.status === "success" ? "Completed" : "Failed"}
            </p>
            <p className="text-[12px] text-[#6E6E73] mt-2">
              Tenant: {state.tenantId ?? "n/a"} · Session: {state.sessionId ?? "n/a"} · Export: {state.exportRunId ?? "n/a"}
            </p>
            <p className="text-[12px] text-[#6E6E73]">
              Confidence: {state.confidence ?? "n/a"} · Started: {state.startedAt ?? "n/a"}
            </p>
            {state.error ? <p className="text-[12px] text-[#D70015] mt-2">{state.error}</p> : null}
          </div>

          <div className="rounded-xl border border-[#E5E5EA] p-4">
            <p className="text-[12px] text-[#6E6E73] mb-3">Execution steps</p>
            <ul className="space-y-2">
              {state.steps.map((step) => (
                <li
                  key={`${step.name}-${step.detail}`}
                  className="text-[13px] text-[#1D1D1F] flex items-start gap-2"
                >
                  <span className={step.ok ? "text-[#34C759]" : "text-[#D70015]"}>{step.ok ? "●" : "●"}</span>
                  <span>
                    <strong className="font-medium">{step.name}:</strong> {step.detail}
                    {step.requestId ? <span className="text-[#6E6E73]"> (request_id={step.requestId})</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}
