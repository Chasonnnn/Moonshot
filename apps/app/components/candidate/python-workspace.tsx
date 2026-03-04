"use client"

import { useState, useCallback } from "react"
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
      runtime_ms: runtimeMs,
      mock: true,
    }
  }
  return {
    ok: true,
    stdout: "R mock execution complete.",
    stderr: null,
    plot_url: null,
    runtime_ms: runtimeMs,
    mock: true,
  }
}

export function AnalysisWorkspace() {
  const { api, isSubmitted, isExpired, track, fixtureData, currentRoundIndex } = useSession()
  const [language, setLanguage] = useState<AnalysisLanguage>("python")
  const [code, setCode] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pythonHistory, setPythonHistory] = useState<PythonHistoryItem[]>([])
  const [rHistory, setRHistory] = useState<RHistoryItem[]>([])

  const runCode = useCallback(async () => {
    if (!code.trim() || isRunning || isSubmitted || isExpired) return

    setIsRunning(true)
    setError(null)

    try {
      if (language === "python") {
        const res = await api.runPython(code)
        setResult({ ...res, source: "python_api" })
        track("python_code_run", {
          code_length: code.length,
          runtime_ms: res.runtime_ms,
          has_plot: !!res.plot_url,
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
  }, [api, code, isExpired, isRunning, isSubmitted, language, track])

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
            <div className="border-b border-[#D2D2D7] bg-[#F5F5F7] px-3 py-2">
              <p className="text-[11px] font-medium text-[#1D1D1F]">
                {fixtureData.rounds[currentRoundIndex].title}
              </p>
              <p className="mt-0.5 text-[11px] text-[#6E6E73]">
                Suggested artifacts: {fixtureData.rounds[currentRoundIndex].mockedArtifacts.join(", ")}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#D2D2D7] px-3 py-1.5">
            <div className="inline-flex rounded-md border border-[#D2D2D7] bg-white p-0.5">
              <button
                type="button"
                onClick={() => selectLanguage("python")}
                className={`rounded px-2 py-1 text-[12px] font-medium ${
                  language === "python" ? "bg-[#1D1D1F] text-white" : "text-[#1D1D1F]"
                }`}
              >
                Python
              </button>
              <button
                type="button"
                onClick={() => selectLanguage("r")}
                className={`rounded px-2 py-1 text-[12px] font-medium ${
                  language === "r" ? "bg-[#1D1D1F] text-white" : "text-[#1D1D1F]"
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
              className="h-7 gap-1.5 text-[12px]"
              aria-label="Run"
            >
              {isRunning ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </Button>
            <span className="text-[11px] text-[#86868B]">&#8984; Enter</span>
            {language === "r" && (
              <span className="rounded-full bg-[#FF9F0A]/12 px-2 py-1 text-[10px] font-medium text-[#A05A00]">
                Mock execution only
              </span>
            )}
            <div className="flex-1" />
            <Sheet>
              <SheetTrigger
                onClick={loadHistory}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-[#1D1D1F] hover:bg-[#F5F5F7]"
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
                      className="block w-full rounded-lg border border-[#D2D2D7] p-2 text-left text-[12px] hover:bg-[#F5F5F7]"
                    >
                      <code className="line-clamp-2 font-mono text-[11px] text-[#1D1D1F]">
                        {item.code}
                      </code>
                      <span className={`mt-1 block text-[10px] ${item.ok ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                        {item.ok ? `${item.runtime_ms}ms` : "Error"}
                      </span>
                    </button>
                  ))}
                  {activeHistory.length === 0 && (
                    <p className="text-[12px] text-[#86868B]">No scripts yet</p>
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
            className="flex-1 resize-none bg-[#1D1D1F] p-3 font-mono text-[13px] text-white outline-none placeholder:text-[#86868B]"
            spellCheck={false}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={60} minSize={20}>
        <ScrollArea className="h-full">
          {!result && !error && (
            <p className="p-4 text-[13px] text-[#86868B]">
              Run code to see output
            </p>
          )}

          {error && (
            <div className="m-3 rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/5 p-3">
              <p className="text-[13px] font-medium text-[#FF3B30]">Error</p>
              <p className="mt-1 text-[12px] text-[#FF3B30]/80">{error}</p>
            </div>
          )}

          {result && !error && (
            <div className="space-y-3 p-3">
              {result.source === "r_mock" && (
                <div className="rounded-lg border border-[#FF9F0A]/25 bg-[#FF9F0A]/10 px-3 py-2 text-[12px] text-[#A05A00]">
                  R mode is mock and non-executing for MVP demos.
                </div>
              )}
              {result.stdout && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">
                    Output
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-[#F5F5F7] p-3 font-mono text-[12px] text-[#1D1D1F]">
                    {result.stdout}
                  </pre>
                </div>
              )}
              {result.stderr && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#FF9F0A]">
                    Stderr
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-[#FF9F0A]/5 p-3 font-mono text-[12px] text-[#A05A00]">
                    {result.stderr}
                  </pre>
                </div>
              )}
              {result.plot_url && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">
                    Plot
                  </p>
                  <div className="flex items-center justify-center rounded-lg bg-[#F5F5F7] p-4">
                    <div className="flex h-32 w-48 items-center justify-center rounded-md border border-dashed border-[#D2D2D7] text-[12px] text-[#86868B]">
                      Plot: {result.plot_url}
                    </div>
                  </div>
                </div>
              )}
              <div className="border-t border-[#D2D2D7] pt-1.5 text-[11px] text-[#86868B]">
                {result.runtime_ms}ms
              </div>
            </div>
          )}
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
