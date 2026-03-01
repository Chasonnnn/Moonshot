"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useSession } from "@/components/candidate/session-context"
import type { DashboardState } from "@/lib/moonshot/types"

export function DashboardWorkspace() {
  const { api, isSubmitted, isExpired } = useSession()
  const [state, setState] = useState<DashboardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState("")

  useEffect(() => {
    api
      .getDashboardState()
      .then(setState)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [api])

  const addAnnotation = async () => {
    if (!note.trim() || isSubmitted || isExpired) return
    try {
      const updated = await api.dashboardAction("annotate", { note: note.trim() })
      setState(updated)
      setNote("")
    } catch {
      // silent
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
        <div>
          <h3 className="text-[13px] font-medium text-[#1D1D1F]">
            Dashboard State <span className="text-[#FF9F0A]">?</span>
          </h3>
          <p className="mt-1 text-[11px] text-[#86868B]">
            Dashboard interaction model may evolve
          </p>
        </div>

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

            {!isSubmitted && !isExpired && (
              <div className="flex gap-2">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
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
