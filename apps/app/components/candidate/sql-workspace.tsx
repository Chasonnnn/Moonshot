"use client"

import { useState, useCallback } from "react"
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
  const { api, isSubmitted, isExpired, track } = useSession()
  const [query, setQuery] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<SqlRunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<SqlHistoryItem[]>([])

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
          <div className="flex items-center gap-2 border-b border-[#D2D2D7] px-3 py-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={runQuery}
              disabled={isSubmitted || isExpired || isRunning || !query.trim()}
              className="h-7 gap-1.5 text-[12px]"
              aria-label="Run"
            >
              {isRunning ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </Button>
            <span className="text-[11px] text-[#86868B]">&#8984; Enter</span>
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
                  <SheetTitle>Query History</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {history.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(item.query)}
                      className="block w-full rounded-lg border border-[#D2D2D7] p-2 text-left text-[12px] hover:bg-[#F5F5F7]"
                    >
                      <code className="line-clamp-2 font-mono text-[11px] text-[#1D1D1F]">
                        {item.query}
                      </code>
                      <span className={`mt-1 block text-[10px] ${item.ok ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                        {item.ok ? `${item.row_count} rows` : "Error"}
                      </span>
                    </button>
                  ))}
                  {history.length === 0 && (
                    <p className="text-[12px] text-[#86868B]">No queries yet</p>
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
              Run a query to see results
            </p>
          )}

          {error && (
            <div className="m-3 rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/5 p-3">
              <p className="text-[13px] font-medium text-[#FF3B30]">Error</p>
              <p className="mt-1 text-[12px] text-[#FF3B30]/80">{error}</p>
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
              <div className="border-t border-[#D2D2D7] px-3 py-1.5 text-[11px] text-[#86868B]">
                {result.row_count} rows · {result.runtime_ms}ms
              </div>
            </>
          )}
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
