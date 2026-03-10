"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { useSession } from "@/components/candidate/session-context"
import { getRoundToolActions, type DemoCoachTurn, type DemoFixtureData, type DemoToolAction } from "@/lib/moonshot/demo-fixtures"

interface AutoPlayStep {
  label: string
  roundIndex: number
  action: () => Promise<void>
}

const AUTOPLAY_COMPLETE_MESSAGE = "moonshot.autoplay_complete"

function nextCoachResponse(turns: DemoCoachTurn[], userTurn: DemoCoachTurn): DemoCoachTurn | null {
  const turnIndex = turns.findIndex((candidate) => candidate === userTurn)
  if (turnIndex < 0) return null
  const response = turns[turnIndex + 1]
  if (!response || response.role !== "coach") return null
  return response
}

function toolLabel(action: DemoToolAction): string {
  const prefix =
    action.tool === "bi"
      ? "BI"
      : action.tool === "oral"
        ? "Oral"
        : action.tool.charAt(0).toUpperCase() + action.tool.slice(1)
  return `${prefix} ${action.label}`
}

export function AutoPlayController({ fixture }: { fixture: DemoFixtureData }) {
  const {
    api,
    isAiDisabled,
    session,
    setFinalResponse,
    setActiveWorkspace,
    track,
    pushCoachMessage,
    setCurrentRoundIndex,
  } = useSession()
  const [currentStep, setCurrentStep] = useState(0)
  const [currentRound, setCurrentRound] = useState(0)
  const [stepLabel, setStepLabel] = useState("Starting auto-play...")
  const [isComplete, setIsComplete] = useState(false)
  const [failure, setFailure] = useState<{ stepIndex: number; label: string; message: string } | null>(null)
  const [runToken, setRunToken] = useState(0)
  const runningRef = useRef(false)

  const buildSteps = useCallback((): AutoPlayStep[] => {
    const steps: AutoPlayStep[] = []
    const templateId =
      typeof session.policy?.demo_template_id === "string"
        ? session.policy.demo_template_id
        : undefined

    if (fixture.rounds.length > 0) {
      fixture.rounds.forEach((round, roundIndex) => {
        steps.push({
          label: `Entering ${round.title}`,
          roundIndex,
          action: async () => {
            setCurrentRoundIndex(roundIndex)
            setCurrentRound(roundIndex)
            track("autoplay_round_started", {
              round_id: round.id,
              round_index: roundIndex + 1,
              total_rounds: fixture.rounds.length,
            })
          },
        })

        for (const toolAction of getRoundToolActions(round)) {
          steps.push({
            label: `Round ${roundIndex + 1}: ${toolLabel(toolAction)}`,
            roundIndex,
            action: async () => {
              switch (toolAction.tool) {
                case "sql": {
                  setActiveWorkspace("sql")
                  if (!toolAction.query) return
                  await api.runSql(toolAction.query)
                  return
                }
                case "python": {
                  setActiveWorkspace("python")
                  if (!toolAction.code) return
                  const runtimeContext =
                    templateId && toolAction.datasetId
                      ? {
                          template_id: templateId,
                          round_id: round.id,
                          dataset_id: toolAction.datasetId,
                        }
                      : undefined
                  const response = await api.runPython(toolAction.code, runtimeContext)
                  track("python_code_run", {
                    source: "autoplay",
                    round_id: round.id,
                    runtime_ms: response.runtime_ms,
                    artifact_count: response.artifacts.length,
                  })
                  return
                }
                case "r": {
                  setActiveWorkspace("python")
                  track("analysis_r_run", {
                    source: "autoplay_mock",
                    round_id: round.id,
                    code_length: toolAction.code?.length ?? 0,
                    has_plot: Boolean(toolAction.plotUrl),
                  })
                  return
                }
                case "dashboard": {
                  setActiveWorkspace("dashboard")
                  track("dashboard_action", {
                    source: "autoplay",
                    round_id: round.id,
                    action: toolAction.action ?? toolAction.detail ?? toolAction.label,
                  })
                  return
                }
                case "spreadsheet": {
                  setActiveWorkspace("spreadsheet")
                  track("spreadsheet_action", {
                    source: "autoplay_mock",
                    round_id: round.id,
                    action: toolAction.action ?? toolAction.label,
                    artifact_refs: toolAction.artifactRefs ?? [],
                  })
                  return
                }
                case "bi": {
                  setActiveWorkspace("bi")
                  track("bi_action", {
                    source: "autoplay_mock",
                    round_id: round.id,
                    action: toolAction.action ?? toolAction.label,
                    artifact_refs: toolAction.artifactRefs ?? [],
                  })
                  return
                }
                case "slides": {
                  setActiveWorkspace("slides")
                  track("slides_action", {
                    source: "autoplay_mock",
                    round_id: round.id,
                    action: toolAction.action ?? toolAction.label,
                    artifact_refs: toolAction.artifactRefs ?? [],
                  })
                  return
                }
                case "oral": {
                  setActiveWorkspace("oral")
                  track("oral_response_recorded", {
                    source: "autoplay_mock",
                    round_id: round.id,
                    label: toolAction.label,
                    prompt: toolAction.prompt ?? null,
                    transcript_excerpt: toolAction.transcriptExcerpt ?? null,
                    duration_seconds: toolAction.durationSeconds ?? null,
                  })
                }
              }
            },
          })
        }

        const scriptedCoachTurns = round.coachScript.filter((t) => t.role === "user" && !isAiDisabled)
        for (const turn of scriptedCoachTurns) {
          steps.push({
            label: `Round ${roundIndex + 1}: Coach "${turn.content.slice(0, 40)}..."`,
            roundIndex,
            action: async () => {
              pushCoachMessage({ role: "user", content: turn.content })
              track("copilot_invoked", { source: "autoplay", message_length: turn.content.length })
              const response = nextCoachResponse(round.coachScript, turn)
              if (response) {
                pushCoachMessage({
                  role: "coach",
                  content: response.content,
                  allowed: response.allowed,
                  policyReason: response.policyReason,
                })
              }
            },
          })
        }
      })
    } else {
      // Backward-compatible fallback for older fixtures.
      for (const sqlQuery of fixture.sqlQueries) {
        steps.push({
          label: `Running SQL: ${sqlQuery.query.slice(0, 50)}...`,
          roundIndex: 0,
          action: async () => {
            setActiveWorkspace("sql")
            await api.runSql(sqlQuery.query)
          },
        })
      }

      for (const script of fixture.pythonScripts) {
        steps.push({
          label: `Running Python: ${script.code.split("\n")[0].slice(0, 50)}...`,
          roundIndex: 0,
          action: async () => {
            setActiveWorkspace("python")
            await api.runPython(script.code)
          },
        })
      }

      const scriptedCoachTurns = fixture.coachScript.filter((t) => t.role === "user" && !isAiDisabled)
      for (const turn of scriptedCoachTurns) {
        steps.push({
          label: `Coach: "${turn.content.slice(0, 50)}..."`,
          roundIndex: 0,
          action: async () => {
            pushCoachMessage({ role: "user", content: turn.content })
            track("copilot_invoked", { source: "autoplay", message_length: turn.content.length })
            const response = nextCoachResponse(fixture.coachScript, turn)
            if (response) {
              pushCoachMessage({
                role: "coach",
                content: response.content,
                allowed: response.allowed,
                policyReason: response.policyReason,
              })
            }
          },
        })
      }
    }

    steps.push({
      label: "Writing final response...",
      roundIndex: Math.max(0, fixture.rounds.length - 1),
      action: async () => {
        setActiveWorkspace("report")
        setFinalResponse(fixture.finalResponse)
      },
    })

    return steps
  }, [fixture, api, isAiDisabled, pushCoachMessage, session.policy, setActiveWorkspace, setFinalResponse, setCurrentRoundIndex, track])

  useEffect(() => {
    if (runningRef.current) return
    runningRef.current = true

    const steps = buildSteps()
    let cancelled = false

    async function run() {
      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return
        setCurrentStep(i)
        setCurrentRound(steps[i].roundIndex)
        setCurrentRoundIndex(steps[i].roundIndex)
        setStepLabel(steps[i].label)
        try {
          await steps[i].action()
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown autoplay step failure"
          setFailure({ stepIndex: i, label: steps[i].label, message })
          track("autoplay_step_failed", { step_index: i, step_label: steps[i].label, error_message: message })
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 1300))
      }
      if (!cancelled) {
        setIsComplete(true)
        window.parent?.postMessage({ type: AUTOPLAY_COMPLETE_MESSAGE, sessionId: session.id }, window.location.origin)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [buildSteps, runToken, session.id, setCurrentRoundIndex, track])

  const totalSteps = buildSteps().length
  const roundCount = Math.max(fixture.rounds.length, 1)

  const handleSkipToEnd = useCallback(() => {
    setActiveWorkspace("report")
    setFinalResponse(fixture.finalResponse)
    setCurrentRoundIndex(Math.max(0, (fixture.rounds.length || 1) - 1))
    setIsComplete(true)
    window.parent?.postMessage({ type: AUTOPLAY_COMPLETE_MESSAGE, sessionId: session.id }, window.location.origin)
  }, [fixture.finalResponse, fixture.rounds.length, session.id, setActiveWorkspace, setCurrentRoundIndex, setFinalResponse])

  const handleRetry = useCallback(() => {
    setFailure(null)
    setCurrentStep(0)
    setCurrentRound(0)
    setCurrentRoundIndex(0)
    setStepLabel("Retrying auto-play...")
    setRunToken((prev) => prev + 1)
    runningRef.current = false
  }, [setCurrentRoundIndex])

  if (isComplete) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#34C759] px-4 py-2 text-[13px] font-medium text-white shadow-lg">
        Auto-play complete
      </div>
    )
  }

  if (failure) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 w-[min(680px,92vw)] -translate-x-1/2 rounded-xl border border-[#FF3B30]/30 bg-white p-4 shadow-lg">
        <p className="text-[13px] font-semibold text-[#FF3B30]">Auto-play paused</p>
        <p className="mt-1 text-[12px] text-[#1D1D1F]">{failure.label}</p>
        <p className="mt-1 text-[12px] text-[#6E6E73]">{failure.message}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleRetry}
            className="rounded-full bg-[#0071E3] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0077ED]"
          >
            Retry Auto-Play
          </button>
          <button
            onClick={handleSkipToEnd}
            className="rounded-full border border-[#D2D2D7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
          >
            Skip to End
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#1D1D1F] px-4 py-2.5 shadow-lg">
      <Spinner className="h-4 w-4 text-white" />
      <span className="max-w-[360px] truncate text-[13px] text-white">{stepLabel}</span>
      <span className="text-[12px] text-[#86868B]">{currentStep + 1}/{totalSteps}</span>
      <span className="text-[12px] text-[#A1D7FF]">Round {Math.min(currentRound + 1, roundCount)}</span>
      <button
        onClick={handleSkipToEnd}
        className="ml-2 rounded-full bg-white/20 px-3 py-1 text-[12px] font-medium text-white hover:bg-white/30"
      >
        Skip
      </button>
    </div>
  )
}
