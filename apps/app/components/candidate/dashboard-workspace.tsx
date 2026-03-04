"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useSession } from "@/components/candidate/session-context"
import { CandidateApiError } from "@/lib/moonshot/candidate-client"
import type { DashboardState } from "@/lib/moonshot/types"

export function DashboardWorkspace() {
  const { api, isSubmitted, isExpired, fixtureData, currentRoundIndex } = useSession()
  const [state, setState] = useState<DashboardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const toErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof CandidateApiError) return err.message
    if (err instanceof Error) return err.message
    return fallback
  }

  const loadState = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextState = await api.getDashboardState()
      setState(nextState)
    } catch (err: unknown) {
      setError(toErrorMessage(err, "Failed to load dashboard state"))
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    let cancelled = false

    const loadInitialState = async () => {
      try {
        const nextState = await api.getDashboardState()
        if (!cancelled) setState(nextState)
      } catch (err: unknown) {
        if (!cancelled) {
          setError(toErrorMessage(err, "Failed to load dashboard state"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadInitialState()
    return () => {
      cancelled = true
    }
  }, [api])

  const addAnnotation = async () => {
    if (!note.trim() || isSubmitted || isExpired) return
    setActionError(null)
    try {
      const updated = await api.dashboardAction("annotate", { note: note.trim() })
      setState(updated)
      setNote("")
    } catch (err: unknown) {
      const message =
        err instanceof CandidateApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to add annotation"
      setActionError(message)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {fixtureData?.rounds[currentRoundIndex] && (
          <div className="rounded-lg border border-[#E5E5EA] bg-white p-3">
            <p className="text-[12px] font-medium text-[#1D1D1F]">
              {fixtureData.rounds[currentRoundIndex].title}
            </p>
            <p className="mt-1 text-[11px] text-[#6E6E73]">
              Suggested dashboard actions for this round
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-[#1D1D1F]">
              {fixtureData.rounds[currentRoundIndex].dashboardActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            {fixtureData.rounds[currentRoundIndex].mockedArtifacts.length > 0 && (
              <p className="mt-2 text-[11px] text-[#6E6E73]">
                Artifacts: {fixtureData.rounds[currentRoundIndex].mockedArtifacts.join(", ")}
              </p>
            )}
          </div>
        )}

        <div>
          <h3 className="text-[13px] font-medium text-[#1D1D1F]">
            Dashboard State <span className="text-[#FF9F0A]">?</span>
          </h3>
          <p className="mt-1 text-[11px] text-[#86868B]">
            Dashboard interaction model may evolve
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/5 p-3">
            <p className="text-[13px] font-medium text-[#FF3B30]">Error</p>
            <p className="mt-1 text-[12px] text-[#FF3B30]/80">{error}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadState}
              className="mt-2 h-7 text-[12px] text-[#FF3B30] hover:text-[#FF3B30]"
            >
              Retry
            </Button>
          </div>
        )}

        {state && (
          <>
            <div>
              <p className="text-[12px] font-medium text-[#86868B]">View</p>
              <p className="text-[13px] text-[#1D1D1F]">{state.view}</p>
            </div>

            <div>
              <p className="text-[12px] font-medium text-[#86868B]">Filters</p>
              {Object.keys(state.filters).length === 0 ? (
                <p className="text-[12px] text-[#86868B]">None</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {Object.entries(state.filters).map(([k, v]) => (
                    <li key={k} className="text-[12px] text-[#1D1D1F]">
                      <span className="font-medium">{k}:</span> {String(v)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            <div>
              <p className="text-[12px] font-medium text-[#86868B]">
                Annotations ({state.annotations.length})
              </p>
              {state.annotations.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {state.annotations.map((a, i) => (
                    <li key={i} className="rounded border border-[#D2D2D7] px-2 py-1 text-[12px] text-[#1D1D1F]">
                      {a}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {actionError && (
              <div className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/5 p-3">
                <p className="text-[12px] text-[#FF3B30]/80">{actionError}</p>
              </div>
            )}

            {!isSubmitted && !isExpired && (
              <div className="flex gap-2">
                <Input
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    if (actionError) setActionError(null)
                  }}
                  placeholder="Add a note..."
                  className="h-8 text-[12px]"
                  onKeyDown={(e) => e.key === "Enter" && addAnnotation()}
                />
                <Button
                  size="sm"
                  onClick={addAnnotation}
                  disabled={!note.trim()}
                  className="h-8 text-[12px]"
                >
                  Add Note
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  )
}
