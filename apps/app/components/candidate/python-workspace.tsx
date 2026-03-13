"use client"

import { useState, useCallback, type SetStateAction } from "react"
import { Play, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useSession } from "@/components/candidate/session-context"
import { CandidateApiError } from "@/lib/moonshot/candidate-client"
import type { PythonRunResponse, PythonHistoryItem, RHistoryItem, RRunResponse } from "@/lib/moonshot/types"

type AnalysisLanguage = "python" | "r"

type AnalysisHistoryItem = PythonHistoryItem | RHistoryItem

interface AnalysisResult extends Omit<PythonRunResponse, "ok"> {
  ok: boolean
  source: "python_api" | "r_mock"
}

function runRMock(code: string): RRunResponse {
  const normalized = code.toLowerCase()
  const blockedPatterns = ["system(", "file(", "readlines(", "write(", "shell("]
  if (blockedPatterns.some((pattern) => normalized.includes(pattern))) {
    throw new Error("disallowed r operation")
  }

  const runtimeMs = 31
  if (normalized.includes("ggplot") || normalized.includes("plot(")) {
    return {
      ok: true,
      stdout: "Generated mock visualization for the selected KPI trend.",
      stderr: null,
      plot_url: "/mock/r-trend-plot.png",
      artifacts: [],
      runtime_ms: runtimeMs,
      mock: true,
    }
  }
  if (normalized.includes("summary(") || normalized.includes("lm(")) {
    return {
      ok: true,
      stdout: "Residuals:\n Min -0.42  1Q -0.11  Median 0.02  3Q 0.14  Max 0.57",
      stderr: null,
      plot_url: null,
      artifacts: [],
      runtime_ms: runtimeMs,
      mock: true,
    }
  }
  return {
    ok: true,
    stdout: "R mock execution complete.",
    stderr: null,
    plot_url: null,
    artifacts: [],
    runtime_ms: runtimeMs,
    mock: true,
  }
}

export function AnalysisWorkspace() {
  const {
    api,
    isSubmitted,
    isExpired,
    track,
    fixtureData,
    currentRoundIndex,
    session,
    parts,
    activePart,
    autoPlay,
    analysisReplayState,
    setAnalysisReplayState,
  } = useSession()
  const [languageState, setLanguageState] = useState<AnalysisLanguage>("python")
  const [codeState, setCodeState] = useState("")
  const [isRunningState, setIsRunningState] = useState(false)
  const [resultState, setResultState] = useState<AnalysisResult | null>(null)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [pythonHistoryState, setPythonHistoryState] = useState<PythonHistoryItem[]>([])
  const [rHistoryState, setRHistoryState] = useState<RHistoryItem[]>([])

  const activeStage = parts[activePart] ?? null
  const showStageFlow = parts.length > 0 && fixtureData?.rounds.length === parts.length
  const language = autoPlay ? analysisReplayState.language : languageState
  const code = autoPlay ? analysisReplayState.code : codeState
  const isRunning = autoPlay ? analysisReplayState.isRunning : isRunningState
  const result = autoPlay ? analysisReplayState.result : resultState
  const error = autoPlay ? analysisReplayState.error : errorState
  const pythonHistory = autoPlay ? analysisReplayState.pythonHistory : pythonHistoryState
  const rHistory = autoPlay ? analysisReplayState.rHistory : rHistoryState

  const setLanguage = useCallback((next: SetStateAction<AnalysisLanguage>) => {
    if (autoPlay) {
      setAnalysisReplayState((prev) => ({
        ...prev,
        language: typeof next === "function" ? next(prev.language) : next,
      }))
      return
    }
    setLanguageState(next)
  }, [autoPlay, setAnalysisReplayState])

  const setCode = useCallback((next: SetStateAction<string>) => {
    if (autoPlay) {
      setAnalysisReplayState((prev) => ({
        ...prev,
        code: typeof next === "function" ? next(prev.code) : next,
      }))
      return
    }
    setCodeState(next)
  }, [autoPlay, setAnalysisReplayState])

  const setIsRunning = useCallback((next: SetStateAction<boolean>) => {
    if (autoPlay) {
      setAnalysisReplayState((prev) => ({
        ...prev,
        isRunning: typeof next === "function" ? next(prev.isRunning) : next,
      }))
      return
    }
    setIsRunningState(next)
  }, [autoPlay, setAnalysisReplayState])

  const setResult = useCallback((next: SetStateAction<AnalysisResult | null>) => {
    if (autoPlay) {
      setAnalysisReplayState((prev) => ({
        ...prev,
        result: typeof next === "function" ? next(prev.result) : next,
      }))
      return
    }
    setResultState(next)
  }, [autoPlay, setAnalysisReplayState])

  const setError = useCallback((next: SetStateAction<string | null>) => {
    if (autoPlay) {
      setAnalysisReplayState((prev) => ({
        ...prev,
        error: typeof next === "function" ? next(prev.error) : next,
      }))
      return
    }
    setErrorState(next)
  }, [autoPlay, setAnalysisReplayState])

  const setPythonHistory = useCallback((next: SetStateAction<PythonHistoryItem[]>) => {
    if (autoPlay) {
      setAnalysisReplayState((prev) => ({
        ...prev,
        pythonHistory: typeof next === "function" ? next(prev.pythonHistory) : next,
      }))
      return
    }
    setPythonHistoryState(next)
  }, [autoPlay, setAnalysisReplayState])

  const setRHistory = useCallback((next: SetStateAction<RHistoryItem[]>) => {
    if (autoPlay) {
      setAnalysisReplayState((prev) => ({
        ...prev,
        rHistory: typeof next === "function" ? next(prev.rHistory) : next,
      }))
      return
    }
    setRHistoryState(next)
  }, [autoPlay, setAnalysisReplayState])

  const runCode = useCallback(async () => {
    if (!code.trim() || isRunning || isSubmitted || isExpired) return

    setIsRunning(true)
    setError(null)

    try {
      if (language === "python") {
        const templateId =
          typeof session?.policy?.demo_template_id === "string"
            ? session.policy.demo_template_id
            : undefined
        const currentRound = fixtureData?.rounds[currentRoundIndex]
        const datasetId = currentRound?.pythonScripts.find((item) => item.datasetId)?.datasetId
        const runtimeContext =
          templateId && currentRound?.id && datasetId
            ? {
                template_id: templateId,
                round_id: currentRound.id,
                dataset_id: datasetId,
              }
            : undefined
        const res = await api.runPython(code, runtimeContext)
        setResult({ ...res, source: "python_api" })
        track("python_code_run", {
          code_length: code.length,
          runtime_ms: res.runtime_ms,
          has_plot: !!res.plot_url,
          artifact_count: res.artifacts.length,
        })
      } else {
        const res = runRMock(code)
        setResult({ ...res, source: "r_mock" })
        setRHistory((prev) => [
          ...prev,
          {
            code,
            ok: true,
            stdout: res.stdout,
            stderr: res.stderr,
            plot_url: res.plot_url,
            error: null,
            runtime_ms: res.runtime_ms,
            executed_at: new Date().toISOString(),
          },
        ])
        track("analysis_r_run", {
          code_length: code.length,
          runtime_ms: res.runtime_ms,
          has_plot: !!res.plot_url,
          source: "mock",
        })
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as Record<string, unknown>).message)
            : String(err)
      const errorCode = err instanceof CandidateApiError ? err.errorCode : "unknown_error"
      setError(message)
      setResult(null)
      if (language === "python") {
        track("python_code_error", {
          code_length: code.length,
          error_code: errorCode,
        })
      } else {
        setRHistory((prev) => [
          ...prev,
          {
            code,
            ok: false,
            stdout: null,
            stderr: message,
            plot_url: null,
            error: errorCode,
            runtime_ms: 0,
            executed_at: new Date().toISOString(),
          },
        ])
        track("analysis_r_error", {
          code_length: code.length,
          error_code: errorCode,
          source: "mock",
        })
      }
    } finally {
      setIsRunning(false)
    }
  }, [
    api,
    code,
    currentRoundIndex,
    fixtureData,
    isExpired,
    isRunning,
    isSubmitted,
    language,
    session?.policy?.demo_template_id,
    track,
  ])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      runCode()
    }
  }

  const loadHistory = async () => {
    if (language === "r") return
    try {
      const res = await api.getPythonHistory()
      setPythonHistory(res.items)
    } catch {
      // Explicit UI error isn't required for history panel; main run path remains strict.
    }
  }

  const activeHistory: AnalysisHistoryItem[] = language === "python" ? pythonHistory : rHistory

  const selectLanguage = (next: AnalysisLanguage) => {
    setLanguage(next)
    setResult(null)
    setError(null)
  }

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      <ResizablePanel defaultSize={40} minSize={20}>
        <div className="flex h-full flex-col">
          {fixtureData?.rounds[currentRoundIndex] && (
            <div className="border-b border-[var(--ops-border)] bg-[var(--ops-page-bg)] px-3 py-2">
              <p className="text-[11px] font-medium text-[var(--ops-text)]">
                {showStageFlow && activeStage ? activeStage.title : fixtureData.rounds[currentRoundIndex].title}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--ops-text-subtle)]">
                Suggested artifacts: {fixtureData.rounds[currentRoundIndex].mockedArtifacts.join(", ")}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ops-border)] px-3 py-2">
            {autoPlay && code.trim().length > 0 ? (
              <span className="rounded-full bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-medium text-[#1D4ED8]">
                Replay input/output
              </span>
            ) : null}
            <div className="inline-flex rounded-[18px] border border-[var(--ops-border)] bg-white p-1">
              <button
                type="button"
                onClick={() => selectLanguage("python")}
                className={`min-h-10 rounded-2xl px-3 py-2 text-[13px] font-medium md:min-h-8 md:px-2 md:py-1 md:text-[12px] ${
                  language === "python" ? "bg-[#1D1D1F] text-white" : "text-[var(--ops-text)]"
                }`}
              >
                Python
              </button>
              <button
                type="button"
                onClick={() => selectLanguage("r")}
                className={`min-h-10 rounded-2xl px-3 py-2 text-[13px] font-medium md:min-h-8 md:px-2 md:py-1 md:text-[12px] ${
                  language === "r" ? "bg-[#1D1D1F] text-white" : "text-[var(--ops-text)]"
                }`}
              >
                R (Mock)
              </button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={runCode}
              disabled={isSubmitted || isExpired || isRunning || !code.trim()}
              className="h-10 rounded-full px-4 text-[13px] md:h-7 md:px-3 md:text-[12px]"
              aria-label="Run"
            >
              {isRunning ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </Button>
            <span className="text-[11px] text-[var(--ops-text-subtle)]">&#8984; Enter</span>
            {language === "r" && (
              <span className="rounded-full bg-[var(--ops-warning)]/12 px-3 py-1.5 text-[11px] font-medium text-[var(--ops-warning)]">
                Mock execution only
              </span>
            )}
            <div className="flex-1" />
            <Sheet>
              <SheetTrigger
                onClick={loadHistory}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] text-[var(--ops-text)] hover:bg-[var(--ops-page-bg)] md:h-7 md:px-2 md:text-[12px]"
                aria-label="History"
              >
                <History className="h-3.5 w-3.5" />
                History
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>{language === "python" ? "Python History" : "R History"}</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {activeHistory.map((item, i) => (
                    <button
                      key={`${item.executed_at}-${i}`}
                      onClick={() => setCode(item.code)}
                      className="block w-full rounded-lg border border-[var(--ops-border)] p-2 text-left text-[12px] hover:bg-[var(--ops-page-bg)]"
                    >
                      <code className="line-clamp-2 font-mono text-[11px] text-[var(--ops-text)]">
                        {item.code}
                      </code>
                      <span className={`mt-1 block text-[10px] ${item.ok ? "text-[var(--ops-success)]" : "text-[var(--ops-danger)]"}`}>
                        {item.ok ? `${item.runtime_ms}ms` : "Error"}
                      </span>
                    </button>
                  ))}
                  {activeHistory.length === 0 && (
                    <p className="text-[12px] text-[var(--ops-text-subtle)]">No scripts yet</p>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitted || isExpired}
            placeholder={language === "python" ? "# Write your Python code here" : "# Write your R code here (mock)"}
            className="flex-1 resize-none bg-[#1D1D1F] p-3 font-mono text-[13px] text-white outline-none placeholder:text-[var(--ops-text-subtle)]"
            spellCheck={false}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={60} minSize={20}>
        <ScrollArea className="h-full">
          {!result && !error && (
            <p className="p-4 text-[13px] text-[var(--ops-text-subtle)]">
              Run code to see output
            </p>
          )}

          {error && (
            <div className="m-3 rounded-lg border border-[var(--ops-danger)]/20 bg-[var(--ops-danger)]/5 p-3">
              <p className="text-[13px] font-medium text-[var(--ops-danger)]">Error</p>
              <p className="mt-1 text-[12px] text-[var(--ops-danger)]/80">{error}</p>
            </div>
          )}

          {result && !error && (
            <div className="space-y-3 p-3">
              {result.source === "r_mock" && (
                <div className="rounded-lg border border-[var(--ops-warning)]/25 bg-[var(--ops-warning)]/10 px-3 py-2 text-[12px] text-[var(--ops-warning)]">
                  R mode is mock and non-executing for MVP demos.
                </div>
              )}
              {result.stdout && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">
                    Output
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-[var(--ops-page-bg)] p-3 font-mono text-[12px] text-[var(--ops-text)]">
                    {result.stdout}
                  </pre>
                </div>
              )}
              {result.stderr && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ops-warning)]">
                    Stderr
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-[var(--ops-warning)]/5 p-3 font-mono text-[12px] text-[var(--ops-warning)]">
                    {result.stderr}
                  </pre>
                </div>
              )}
              {result.plot_url && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">
                    Plot
                  </p>
                  <div className="flex items-center justify-center rounded-lg bg-[var(--ops-page-bg)] p-4">
                    {result.plot_url.startsWith("data:image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.plot_url}
                        alt="Python runtime plot artifact"
                        className="max-h-64 w-auto rounded-md border border-[var(--ops-border)] bg-white"
                      />
                    ) : (
                      <div className="flex h-32 w-48 items-center justify-center rounded-md border border-dashed border-[var(--ops-border)] text-[12px] text-[var(--ops-text-subtle)]">
                        Plot: {result.plot_url}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {result.artifacts.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">
                    Artifact List
                  </p>
                  <ul className="space-y-1 rounded-lg bg-[var(--ops-page-bg)] p-3 text-[12px] text-[var(--ops-text)]">
                    {result.artifacts.map((artifact) => (
                      <li key={artifact.uri} className="flex items-center justify-between gap-3">
                        <span className="font-medium">{artifact.name}</span>
                        <span className="text-[var(--ops-text-subtle)]">
                          {artifact.kind} · {artifact.bytes} bytes
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border-t border-[var(--ops-border)] pt-1.5 text-[11px] text-[var(--ops-text-subtle)]">
                {result.runtime_ms}ms
              </div>
            </div>
          )}
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
