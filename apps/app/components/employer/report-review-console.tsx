"use client"

import { useActionState } from "react"

import { createInterpretationAction, type ReportActionState, type ReportDetailSnapshot } from "@/actions/reports"

const initialReportActionState: ReportActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

export function ReportReviewConsole({ sessionId, snapshot }: { sessionId: string; snapshot: ReportDetailSnapshot }) {
  const [state, formAction, isPending] = useActionState(createInterpretationAction, initialReportActionState)

  if (snapshot.error) {
    return (
      <section className="rounded-2xl border border-[#FF9F0A] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Report View Unavailable</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">{snapshot.error}</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Report Summary</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">
          session_status={snapshot.summary?.session_status ?? "n/a"} · confidence={snapshot.summary?.confidence ?? "n/a"} ·
          needs_human_review={String(snapshot.summary?.needs_human_review ?? "n/a")}
        </p>
        <p className="mt-1 text-[12px] text-[#6E6E73]">
          scorer_version={snapshot.summary?.scoring_version_lock?.scorer_version ?? "n/a"} · model_hash=
          {snapshot.summary?.scoring_version_lock?.model_hash ?? "n/a"}
        </p>
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Interpretation</h2>
        <p className="mt-2 text-[12px] text-[#6E6E73]">
          existing_summary=
          {String(
            (snapshot.report?.interpretation as { summary?: string } | undefined)?.summary ??
              "n/a (report not scored yet)",
          )}
        </p>
        <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="session_id" value={sessionId} />
          <input
            name="focus_dimension"
            placeholder="focus dimension (optional)"
            className="rounded-lg border border-[#D2D2D7] px-2 py-1.5 text-[12px]"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-[#0071E3] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {isPending ? "Generating..." : "Generate Interpretation"}
          </button>
        </form>
        {state.error ? (
          <p className="mt-3 text-[12px] text-[#D70015]">
            {state.error} {state.requestId ? `(request_id=${state.requestId})` : ""}
          </p>
        ) : null}
        {state.ok ? <p className="mt-3 text-[12px] text-[#34C759]">{state.message}</p> : null}
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Safety Evidence</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] text-[#6E6E73]">Red-Team Runs</p>
            <ul className="space-y-2">
              {snapshot.redteamRuns.map((run) => (
                <li key={run.id} className="text-[12px] text-[#1D1D1F]">
                  run={run.id} · status={run.status} · findings={run.findings.length}
                  <span className="text-[#6E6E73]"> · request_id={run.request_id ?? "n/a"}</span>
                </li>
              ))}
              {snapshot.redteamRuns.length === 0 ? <li className="text-[12px] text-[#6E6E73]">No red-team runs linked.</li> : null}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[12px] text-[#6E6E73]">Fairness Runs</p>
            <ul className="space-y-2">
              {snapshot.fairnessRuns.map((run) => (
                <li key={run.id} className="text-[12px] text-[#1D1D1F]">
                  run={run.id} · status={run.status} · sample_size={String(run.summary["sample_size"] ?? "n/a")}
                  <span className="text-[#6E6E73]"> · request_id={run.request_id ?? "n/a"}</span>
                </li>
              ))}
              {snapshot.fairnessRuns.length === 0 ? <li className="text-[12px] text-[#6E6E73]">No fairness runs linked.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
