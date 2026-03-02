"use client"

import { useCallback, useEffect, useState, useTransition } from "react"

import { runDemoFastPath, runDemoAutoComplete } from "@/actions/pilot"
import { loadReportDetailSnapshot, type ReportDetailSnapshot } from "@/actions/reports"
import { DemoGeneratingAnimation } from "@/components/employer/demo-generating-animation"
import { DemoTemplateCard } from "@/components/employer/demo-template-card"
import { ReportReviewConsole } from "@/components/employer/report-review-console"
import { Spinner } from "@/components/ui/spinner"
import { DEMO_CASE_TEMPLATES } from "@/lib/moonshot/demo-case-templates"
import { DEMO_FIXTURES } from "@/lib/moonshot/demo-fixtures"
import type { DemoRunPhase } from "@/lib/moonshot/pilot-flow"
import type { PilotSnapshot } from "@/lib/moonshot/pilot-flow"

const PHASE_STEPS: { key: DemoRunPhase; label: string }[] = [
  { key: "idle", label: "Select Role" },
  { key: "generating", label: "Generating" },
  { key: "preview", label: "Preview & Confirm" },
  { key: "session_ready", label: "Candidate Session" },
  { key: "report", label: "Report" },
]

const GENERATING_STEPS = [
  "Analyzing role requirements\u2026",
  "Generating assessment tasks\u2026",
  "Building scoring rubric\u2026",
  "Preparing candidate workspace\u2026",
]

function phaseIndex(phase: DemoRunPhase): number {
  const idx = PHASE_STEPS.findIndex((s) => s.key === phase)
  return idx >= 0 ? idx : 0
}

function StepIndicator({ phase }: { phase: DemoRunPhase }) {
  const active = phaseIndex(phase)
  return (
    <div className="flex items-center gap-1">
      {PHASE_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div
            className={`flex h-7 items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
              i < active
                ? "bg-[#34C759]/10 text-[#34C759]"
                : i === active
                  ? "bg-[#0071E3] text-white"
                  : "bg-[#F5F5F7] text-[#86868B]"
            }`}
          >
            {i < active ? "\u2713 " : ""}
            {step.label}
          </div>
          {i < PHASE_STEPS.length - 1 && (
            <div className={`mx-1 h-px w-4 ${i < active ? "bg-[#34C759]" : "bg-[#D2D2D7]"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export function DemoConsole({ snapshot }: { snapshot: PilotSnapshot }) {
  const [phase, setPhase] = useState<DemoRunPhase>("idle")
  const [templateId, setTemplateId] = useState<string>(DEMO_CASE_TEMPLATES[0].id)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [candidateUrl, setCandidateUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportSnapshot, setReportSnapshot] = useState<ReportDetailSnapshot | null>(null)

  const [isFastPathPending, startFastPathTransition] = useTransition()
  const [isAutoCompletePending, startAutoCompleteTransition] = useTransition()
  const [isReportLoading, startReportTransition] = useTransition()

  const fixture = DEMO_FIXTURES[templateId] ?? null
  const candidateAutoplayUrl = candidateUrl ? `${candidateUrl}?autoplay=true` : null

  const handleTemplateSelect = useCallback((id: string) => {
    if (phase !== "idle") return
    setTemplateId(id)
  }, [phase])

  const handleGenerateComplete = useCallback(() => {
    setPhase("preview")
  }, [])

  const handleConfirmAndStart = useCallback(() => {
    setPhase("session_ready")
    setError(null)
    startFastPathTransition(async () => {
      try {
        const result = await runDemoFastPath(templateId)
        if (result.error) {
          setError(result.error)
          return
        }
        setSessionId(result.sessionId)
        setCandidateUrl(result.candidateUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fast-path failed")
      }
    })
  }, [templateId])

  const handleWatchAutoPlay = useCallback(() => {
    if (!sessionId) return
    setPhase("playing")
  }, [sessionId])

  const handleSkipToReport = useCallback(() => {
    if (!sessionId) return
    setError(null)
    startAutoCompleteTransition(async () => {
      try {
        const result = await runDemoAutoComplete(sessionId, templateId)
        if (result.error) {
          setError(result.error)
          return
        }
        setPhase("report")
        startReportTransition(async () => {
          try {
            const snap = await loadReportDetailSnapshot(sessionId)
            setReportSnapshot(snap)
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load report")
          }
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Auto-complete failed")
      }
    })
  }, [sessionId, templateId])

  const handleAutoPlayComplete = useCallback(() => {
    handleSkipToReport()
  }, [handleSkipToReport])

  const handleReset = useCallback(() => {
    setPhase("idle")
    setTemplateId(DEMO_CASE_TEMPLATES[0].id)
    setSessionId(null)
    setCandidateUrl(null)
    setError(null)
    setReportSnapshot(null)
  }, [])

  // When playing phase with autoplay=true, listen for postMessage from iframe.
  // Reject unexpected origins/payloads and cross-session events.
  useEffect(() => {
    if (phase !== "playing") return
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (typeof event.data !== "object" || event.data === null) return
      if (!("type" in event.data) || !("sessionId" in event.data)) return
      const payload = event.data as { type?: unknown; sessionId?: unknown }
      if (payload.type !== "moonshot.autoplay_complete") return
      if (typeof payload.sessionId !== "string" || payload.sessionId !== sessionId) return
      handleAutoPlayComplete()
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [phase, handleAutoPlayComplete, sessionId])

  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">
            Demo Console
          </h2>
          <p className="mt-1 text-[13px] text-[#6E6E73]">
            One-click demo: pick a role, watch it generate, preview, auto-play, then review the report.
          </p>
        </div>
        {!snapshot.ok && (
          <div className="rounded-lg border border-[#FF9F0A]/40 bg-[#FF9F0A]/10 px-3 py-1.5 text-[12px] text-[#A05A00]">
            Backend disconnected
          </div>
        )}
      </div>

      <div className="mb-6 overflow-x-auto">
        <StepIndicator phase={phase} />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/5 p-4">
          <p className="text-[13px] font-medium text-[#FF3B30]">Error</p>
          <p className="mt-1 text-[12px] text-[#FF3B30]/80">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-[12px] font-medium text-[#0071E3] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Phase: idle — template selection */}
      {phase === "idle" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {DEMO_CASE_TEMPLATES.map((tpl) => (
              <DemoTemplateCard
                key={tpl.id}
                template={tpl}
                selected={templateId === tpl.id}
                onSelect={() => handleTemplateSelect(tpl.id)}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setPhase("generating")}
              disabled={!snapshot.ok}
              className="rounded-full bg-[#0071E3] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#0077ED] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start Demo
            </button>
          </div>
        </div>
      )}

      {/* Phase: generating — theatrical animation */}
      {phase === "generating" && (
        <div className="rounded-xl border border-[#E5E5EA] p-8">
          <DemoGeneratingAnimation
            steps={GENERATING_STEPS}
            onComplete={handleGenerateComplete}
          />
        </div>
      )}

      {/* Phase: preview — show pre-baked task + rubric */}
      {phase === "preview" && fixture && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E5E5EA] p-6">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">
              Task Prompt
            </p>
            <p className="text-[14px] leading-relaxed text-[#1D1D1F]">
              {fixture.taskPrompt}
            </p>
          </div>
          <div className="rounded-xl border border-[#E5E5EA] p-6">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">
              Rubric Dimensions
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {fixture.rubric.map((dim) => (
                <div key={dim.key} className="rounded-lg bg-[#F5F5F7] px-3 py-2">
                  <p className="text-[13px] font-medium text-[#1D1D1F]">{dim.key.replace(/_/g, " ")}</p>
                  <p className="mt-0.5 text-[12px] text-[#6E6E73]">{dim.anchor}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleConfirmAndStart}
              className="rounded-full bg-[#0071E3] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#0077ED]"
            >
              Confirm &amp; Start Session
            </button>
          </div>
        </div>
      )}

      {/* Phase: session_ready — server work in progress or ready */}
      {phase === "session_ready" && (
        <div className="rounded-xl border border-[#E5E5EA] p-8">
          {isFastPathPending ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Spinner className="h-8 w-8 text-[#0071E3]" />
              <p className="text-[14px] font-medium text-[#1D1D1F]">
                Setting up assessment session...
              </p>
              <p className="text-[12px] text-[#6E6E73]">
                Creating case, generating tasks, auto-approving, and creating session.
              </p>
            </div>
          ) : sessionId ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full bg-[#34C759]/10 p-3">
                <svg className="h-6 w-6 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-[#1D1D1F]">
                Session ready
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleWatchAutoPlay}
                  className="rounded-full bg-[#0071E3] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#0077ED]"
                >
                  Watch Auto-Play
                </button>
                {candidateUrl && (
                  <a
                    href={candidateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-[#D2D2D7] bg-white px-5 py-2.5 text-[14px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
                  >
                    Open in New Tab
                  </a>
                )}
                <button
                  onClick={handleSkipToReport}
                  className="rounded-full border border-[#D2D2D7] bg-white px-5 py-2.5 text-[14px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
                >
                  Skip to Report
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-[14px] text-[#FF3B30]">Session creation failed.</p>
              <button
                onClick={() => setPhase("preview")}
                className="text-[13px] font-medium text-[#0071E3] hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phase: playing — auto-play iframe or skip */}
      {phase === "playing" && sessionId && (
        <div className="space-y-4">
          {isAutoCompletePending ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-[#E5E5EA] py-12">
              <Spinner className="h-8 w-8 text-[#0071E3]" />
              <p className="text-[14px] font-medium text-[#1D1D1F]">
                Completing session and generating report...
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-[#E5E5EA]">
                <iframe
                  src={candidateAutoplayUrl ?? `/session/${sessionId}?autoplay=true`}
                  className="h-[600px] w-full border-0"
                  title="Candidate Session Auto-Play"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                {candidateUrl && (
                  <a
                    href={candidateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-[#D2D2D7] bg-white px-5 py-2.5 text-[14px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
                  >
                    Open in New Tab
                  </a>
                )}
                <button
                  onClick={handleSkipToReport}
                  className="rounded-full border border-[#D2D2D7] bg-white px-5 py-2.5 text-[14px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
                >
                  Skip to Report
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Phase: report — embedded report */}
      {phase === "report" && (
        <div className="space-y-4">
          {isReportLoading || !reportSnapshot ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-[#E5E5EA] py-12">
              <Spinner className="h-8 w-8 text-[#0071E3]" />
              <p className="text-[14px] font-medium text-[#1D1D1F]">Loading report...</p>
            </div>
          ) : sessionId ? (
            <ReportReviewConsole sessionId={sessionId} snapshot={reportSnapshot} />
          ) : null}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleReset}
              className="rounded-full border border-[#D2D2D7] bg-white px-5 py-2.5 text-[14px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
            >
              Start New Demo
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
