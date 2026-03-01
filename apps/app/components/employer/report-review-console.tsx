"use client"

import { useActionState } from "react"

import { createInterpretationAction, type ReportActionState, type ReportDetailSnapshot } from "@/actions/reports"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { Badge } from "@/components/ui/badge"

const initialReportActionState: ReportActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

function formatConfidence(value: unknown): string {
  if (value === null || value === undefined || value === "n/a") return "n/a"
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return `${Math.round(num * 100)}%`
}

export function ReportReviewConsole({ sessionId, snapshot }: { sessionId: string; snapshot: ReportDetailSnapshot }) {
  const [state, formAction, isPending] = useActionState(createInterpretationAction, initialReportActionState)
  useActionStateToast(state)

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
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Status</p>
            <div className="mt-0.5">
              <Badge variant="outline" className="text-[11px]">{snapshot.summary?.session_status ?? "n/a"}</Badge>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Confidence</p>
            <p className="mt-0.5 text-[13px] text-[#1D1D1F]">{formatConfidence(snapshot.summary?.confidence)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Human Review</p>
            <div className="mt-0.5">
              {snapshot.summary?.needs_human_review === null || snapshot.summary?.needs_human_review === undefined ? (
                <span className="text-[13px] text-[#6E6E73]">n/a</span>
              ) : (
                <Badge
                  variant={snapshot.summary.needs_human_review ? "destructive" : "secondary"}
                  className="text-[11px]"
                >
                  {snapshot.summary.needs_human_review ? "Required" : "Clear"}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {snapshot.summary?.scoring_version_lock && (
          <div className="mt-3 border-t border-[#E5E5EA] pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Scorer Version</p>
            <p className="mt-0.5 font-mono text-[12px] text-[#6E6E73]">
              {snapshot.summary.scoring_version_lock.scorer_version ?? "n/a"} · {snapshot.summary.scoring_version_lock.model_hash ?? "n/a"}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Interpretation</h2>
        {(snapshot.report?.interpretation as { summary?: string } | undefined)?.summary ? (
          <p className="mt-2 text-[13px] text-[#1D1D1F]">
            {(snapshot.report?.interpretation as { summary?: string }).summary}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-[#6E6E73]">No interpretation generated yet.</p>
        )}
        <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="session_id" value={sessionId} />
          <input
            name="focus_dimension"
            placeholder="Focus dimension (optional)"
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
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Safety Evidence</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#6E6E73]">Red-Team Runs</p>
            <div className="space-y-2">
              {snapshot.redteamRuns.map((run) => (
                <div key={run.id} className="flex items-center gap-2 text-[12px]">
                  <Badge variant="outline" className="text-[11px]">{run.status}</Badge>
                  <span className="font-mono text-[#1D1D1F]">{run.id.slice(0, 8)}</span>
                  <span className="text-[#6E6E73]">{run.findings.length} findings</span>
                </div>
              ))}
              {snapshot.redteamRuns.length === 0 ? <p className="text-[12px] text-[#6E6E73]">No red-team runs linked.</p> : null}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#6E6E73]">Fairness Runs</p>
            <div className="space-y-2">
              {snapshot.fairnessRuns.map((run) => (
                <div key={run.id} className="flex items-center gap-2 text-[12px]">
                  <Badge variant="outline" className="text-[11px]">{run.status}</Badge>
                  <span className="font-mono text-[#1D1D1F]">{run.id.slice(0, 8)}</span>
                  <span className="text-[#6E6E73]">Sample: {String(run.summary["sample_size"] ?? "n/a")}</span>
                </div>
              ))}
              {snapshot.fairnessRuns.length === 0 ? <p className="text-[12px] text-[#6E6E73]">No fairness runs linked.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
