"use client"

import { useState, useCallback, type SetStateAction } from "react"
import { Play, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import type { SqlRunResponse, SqlHistoryItem } from "@/lib/moonshot/types"

export function SqlWorkspace() {
  const { api, isSubmitted, isExpired, track, autoPlay, sqlReplayState, setSqlReplayState } = useSession()
  const [queryState, setQueryState] = useState("")
  const [isRunningState, setIsRunningState] = useState(false)
  const [resultState, setResultState] = useState<SqlRunResponse | null>(null)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [historyState, setHistoryState] = useState<SqlHistoryItem[]>([])

  const query = autoPlay ? sqlReplayState.query : queryState
  const isRunning = autoPlay ? sqlReplayState.isRunning : isRunningState
  const result = autoPlay ? sqlReplayState.result : resultState
  const error = autoPlay ? sqlReplayState.error : errorState
  const history = autoPlay ? sqlReplayState.history : historyState

  const setQuery = useCallback((next: SetStateAction<string>) => {
    if (autoPlay) {
      setSqlReplayState((prev) => ({
        ...prev,
        query: typeof next === "function" ? next(prev.query) : next,
      }))
      return
    }
    setQueryState(next)
  }, [autoPlay, setSqlReplayState])

  const setIsRunning = useCallback((next: SetStateAction<boolean>) => {
    if (autoPlay) {
      setSqlReplayState((prev) => ({
        ...prev,
        isRunning: typeof next === "function" ? next(prev.isRunning) : next,
      }))
      return
    }
    setIsRunningState(next)
  }, [autoPlay, setSqlReplayState])

  const setResult = useCallback((next: SetStateAction<SqlRunResponse | null>) => {
    if (autoPlay) {
      setSqlReplayState((prev) => ({
        ...prev,
        result: typeof next === "function" ? next(prev.result) : next,
      }))
      return
    }
    setResultState(next)
  }, [autoPlay, setSqlReplayState])

  const setError = useCallback((next: SetStateAction<string | null>) => {
    if (autoPlay) {
      setSqlReplayState((prev) => ({
        ...prev,
        error: typeof next === "function" ? next(prev.error) : next,
      }))
      return
    }
    setErrorState(next)
  }, [autoPlay, setSqlReplayState])

  const setHistory = useCallback((next: SetStateAction<SqlHistoryItem[]>) => {
    if (autoPlay) {
      setSqlReplayState((prev) => ({
        ...prev,
        history: typeof next === "function" ? next(prev.history) : next,
      }))
      return
    }
    setHistoryState(next)
  }, [autoPlay, setSqlReplayState])

  const runQuery = useCallback(async () => {
    if (!query.trim() || isRunning || isSubmitted || isExpired) return

    setIsRunning(true)
    setError(null)

    try {
      const res = await api.runSql(query)
      setResult(res)
      track("sql_query_run", {
        query_length: query.length,
        row_count: res.row_count,
        runtime_ms: res.runtime_ms,
      })
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
      track("sql_query_error", {
        query_length: query.length,
        error_code: errorCode,
      })
    } finally {
      setIsRunning(false)
    }
  }, [query, isRunning, isSubmitted, isExpired, api, track])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      runQuery()
    }
  }

  const loadHistory = async () => {
    try {
      const res = await api.getSqlHistory()
      setHistory(res.items)
    } catch {
      // silent
    }
  }

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      <ResizablePanel defaultSize={40} minSize={20}>
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ops-border)] px-3 py-2">
            {autoPlay && query.trim().length > 0 ? (
              <span className="rounded-full bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-medium text-[#1D4ED8]">
                Replay input/output
              </span>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={runQuery}
              disabled={isSubmitted || isExpired || isRunning || !query.trim()}
              className="h-10 rounded-full px-4 text-[13px] md:h-7 md:px-3 md:text-[12px]"
              aria-label="Run"
            >
              {isRunning ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </Button>
            <span className="text-[11px] text-[var(--ops-text-subtle)]">&#8984; Enter</span>
            <div className="flex-1" />
            <Sheet>
              <SheetTrigger
                onClick={loadHistory}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] text-[var(--ops-text)] hover:bg-[var(--ops-surface-muted)] md:h-7 md:px-2 md:text-[12px]"
                aria-label="History"
              >
                <History className="h-3.5 w-3.5" />
                History
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>Query History</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {history.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(item.query)}
                      className="block w-full rounded-lg border border-[var(--ops-border)] p-2 text-left text-[12px] hover:bg-[var(--ops-surface-muted)]"
                    >
                      <code className="line-clamp-2 font-mono text-[11px] text-[var(--ops-text)]">
                        {item.query}
                      </code>
                      <span className={`mt-1 block text-[10px] ${item.ok ? "text-[var(--ops-success)]" : "text-[var(--ops-danger)]"}`}>
                        {item.ok ? `${item.row_count} rows` : "Error"}
                      </span>
                    </button>
                  ))}
                  {history.length === 0 && (
                    <p className="text-[12px] text-[var(--ops-text-subtle)]">No queries yet</p>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitted || isExpired}
            placeholder="-- Write your SQL query here"
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
              Run a query to see results
            </p>
          )}

          {error && (
            <div className="m-3 rounded-lg border border-[var(--ops-danger)]/20 bg-[var(--ops-danger)]/5 p-3">
              <p className="text-[13px] font-medium text-[var(--ops-danger)]">Error</p>
              <p className="mt-1 text-[12px] text-[var(--ops-danger)]/80">{error}</p>
            </div>
          )}

          {result && !error && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((col) => (
                      <TableHead key={col} className="text-[12px]">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, i) => (
                    <TableRow key={i}>
                      {result.columns.map((col) => (
                        <TableCell key={col} className="font-mono text-[12px]">
                          {String(row[col] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-[var(--ops-border)] px-3 py-1.5 text-[11px] text-[var(--ops-text-subtle)]">
                {result.row_count} rows · {result.runtime_ms}ms
              </div>
            </>
          )}
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
