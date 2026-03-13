"use client"

import { useState, useMemo } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { getVisibleEventTypes, type IntegrityTier } from "@/lib/integrity-tiers"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import type { SessionEvent } from "@/lib/moonshot/types"

type Category = "lifecycle" | "workflow" | "tool" | "integrity" | "ai"

const CATEGORY_COLORS: Record<Category, string> = {
  lifecycle: "#0071E3",
  workflow: "#34C759",
  tool: "#86868B",
  integrity: "#FF9F0A",
  ai: "#AF52DE",
}

const CATEGORY_LABELS: Record<Category, string> = {
  lifecycle: "Lifecycle",
  workflow: "Workflow",
  tool: "Tool",
  integrity: "Integrity",
  ai: "AI",
}

const EVENT_CATEGORY: Record<string, Category> = {
  session_started: "lifecycle",
  session_submitted: "lifecycle",
  stakeholder_recommendation_submitted: "lifecycle",
  co_design_started: "workflow",
  co_design_completed: "workflow",
  task_generation_completed: "workflow",
  round_started: "workflow",
  round_completed: "workflow",
  checkpoint_saved: "workflow",
  deliverable_draft_saved: "workflow",
  coach_message: "workflow",
  sql_query_run: "tool",
  python_code_run: "tool",
  python_run: "tool",
  analysis_r_run: "tool",
  dashboard_action: "tool",
  verification_step_completed: "tool",
  tab_blur_detected: "integrity",
  copy_paste_detected: "integrity",
  copilot_invoked: "ai",
  copilot_output_accepted: "ai",
  copilot_output_edited: "ai",
}

function getCategory(eventType: string): Category {
  return EVENT_CATEGORY[eventType] ?? "tool"
}

function formatRelativeTime(timestamp: string, sessionStart: string): string {
  const diff = new Date(timestamp).getTime() - new Date(sessionStart).getTime()
  const totalSeconds = Math.floor(diff / 1000)
  if (totalSeconds < 0) return "+0:00"
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `+${minutes}:${String(seconds).padStart(2, "0")}`
}

interface EventTimelineProps {
  events: SessionEvent[]
  sessionStartedAt: string
  integrityTier?: string
}

export function EventTimeline({
  events,
  sessionStartedAt,
  integrityTier,
}: EventTimelineProps) {
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => new Set<Category>(["lifecycle", "workflow", "tool", "integrity", "ai"])
  )
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const allowedEventTypes = useMemo(
    () =>
      integrityTier
        ? new Set(getVisibleEventTypes(integrityTier as IntegrityTier))
        : null,
    [integrityTier]
  )

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [events]
  )

  const filtered = useMemo(
    () =>
      sorted
        .filter((e) => !allowedEventTypes || allowedEventTypes.has(e.event_type))
        .filter((e) => activeCategories.has(getCategory(e.event_type))),
    [sorted, allowedEventTypes, activeCategories]
  )

  const counts = useMemo(() => {
    const total = events.length
    const rounds = events.filter((e) => e.event_type === "round_completed").length
    const integrity = events.filter(
      (e) => getCategory(e.event_type) === "integrity"
    ).length
    const ai = events.filter(
      (e) => getCategory(e.event_type) === "ai"
    ).length
    return { total, rounds, integrity, ai }
  }, [events])

  function toggleCategory(cat: Category) {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  if (events.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No events recorded</EmptyTitle>
          <EmptyDescription>
            No session events are available to display.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex gap-4 text-sm" style={{ color: "#1D1D1F" }}>
        <span>
          Total: <strong data-testid="total-count">{counts.total}</strong>
        </span>
        <span>
          Integrity flags:{" "}
          <strong data-testid="integrity-count">{counts.integrity}</strong>
        </span>
        <span>
          AI usage: <strong data-testid="ai-count">{counts.ai}</strong>
        </span>
        <span>
          Rounds tracked: <strong>{counts.rounds}</strong>
        </span>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-4">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
          <label
            key={cat}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <Checkbox
              checked={activeCategories.has(cat)}
              onCheckedChange={() => toggleCategory(cat)}
              aria-label={CATEGORY_LABELS[cat]}
            />
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            {CATEGORY_LABELS[cat]}
          </label>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative ml-3 border-l-2 border-gray-200 pl-6 space-y-4">
        {filtered.map((event, idx) => {
          const cat = getCategory(event.event_type)
          const color = CATEGORY_COLORS[cat]
          const isExpanded = expandedIndex === idx

          return (
            <div key={`${event.timestamp}-${idx}`} className="relative">
              {/* Dot on timeline */}
              <span
                className="absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-white"
                style={{ backgroundColor: color }}
              />

              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-500 font-mono whitespace-nowrap min-w-[52px]">
                  {formatRelativeTime(event.timestamp, sessionStartedAt)}
                </span>

                <Badge
                  data-testid="event-badge"
                  className="text-white text-xs"
                  style={{ backgroundColor: color }}
                >
                  {event.event_type}
                </Badge>

                <button
                  type="button"
                  className="ml-auto p-0.5 text-gray-400 hover:text-gray-600"
                  onClick={() =>
                    setExpandedIndex(isExpanded ? null : idx)
                  }
                  aria-label={`Toggle payload for ${event.event_type}`}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="w-4 h-4" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4" />
                  )}
                </button>
              </div>

              {isExpanded && (
                <pre className="mt-2 ml-[64px] text-xs bg-gray-50 rounded p-2 overflow-x-auto">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
