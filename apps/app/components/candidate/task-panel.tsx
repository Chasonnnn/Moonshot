"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { useSession } from "@/components/candidate/session-context"
import { getModeRules } from "@/components/candidate/session-preflight"
import { ChevronRight } from "lucide-react"

function formatTimer(totalSeconds: number | null): string {
  if (totalSeconds == null) return "--:--"
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function TaskPanel() {
  const {
    session,
    isSubmitted,
    isExpired,
    finalResponse,
    setFinalResponse,
    mode,
    fixtureData,
    currentRoundIndex,
    totalRounds,
    parts,
    activePart,
    setActivePart,
    activePartRemainingSeconds,
    isActivePartExpired,
  } = useSession()
  const rules = getModeRules(mode)
  const currentRound = fixtureData?.rounds[currentRoundIndex] ?? null

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <Collapsible>
          <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-1 rounded-2xl px-3 text-left text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-muted)] transition-colors hover:bg-[var(--ops-surface-subtle,#f8fafc)] hover:text-[var(--ops-text,#1d1d1f)] md:min-h-8 md:px-0">
            <ChevronRight className="h-3.5 w-3.5 transition-transform [[data-panel-open]_&]:rotate-90" />
            Assessment Rules
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-[var(--ops-text,#1d1d1f)]">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {currentRound && (
          <>
            <div>
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-muted)]">
                Current Round
              </h2>
              <p className="mt-2 text-[14px] font-medium text-[var(--ops-text,#1d1d1f)]">
                {currentRound.title} ({currentRoundIndex + 1}/{totalRounds})
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--ops-text-muted,#475569)]">
                {currentRound.objective}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-[var(--ops-text,#1d1d1f)]">
                {currentRound.deliverables.map((deliverable) => (
                  <li key={deliverable}>{deliverable}</li>
                ))}
              </ul>
            </div>
            <Separator />
          </>
        )}

        {parts.length > 0 && (
          <>
            <div>
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-muted)]">
                Assessment Parts
              </h2>
              <div className="mt-2 space-y-1">
                {parts.map((part, i) => (
                  <button
                    key={part.id}
                    onClick={() => setActivePart(i)}
                    className={`min-h-11 w-full rounded-2xl px-3 py-3 text-left text-[13px] transition-colors md:min-h-0 md:rounded-md md:py-2 ${
                      i === activePart
                        ? "bg-[var(--ops-accent-soft,#eff6ff)] font-medium text-[var(--ops-accent-strong,#1d4ed8)]"
                        : "text-[var(--ops-text,#1d1d1f)] hover:bg-[var(--ops-surface-subtle,#f8fafc)]"
                    }`}
                  >
                    <span className="text-[11px] text-[var(--ops-text-muted)]">Part {i + 1}</span>
                    <br />
                    {part.title}
                  </button>
                ))}
              </div>
              {parts[activePart] && (
                <>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--ops-text-muted,#475569)]">
                    {parts[activePart].description}
                  </p>
                  {parts[activePart].time_limit_minutes != null && (
                    <p className={`mt-2 text-[12px] ${isActivePartExpired ? "text-[#ef4444]" : "text-[var(--ops-text-subtle,#64748b)]"}`}>
                      Part timer: {formatTimer(activePartRemainingSeconds)}
                    </p>
                  )}
                </>
              )}
            </div>
            <Separator />
          </>
        )}

        <div>
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-muted)]">
            Task
          </h2>
          <div className="mt-2 text-[15px] leading-relaxed text-[var(--ops-text,#1d1d1f)]">
            {session.task_prompt}
          </div>
        </div>

        <Separator />

        <div>
          <label
            htmlFor="final-response"
            className="text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-muted)]"
          >
            Final Response
          </label>
          <Textarea
            id="final-response"
            value={finalResponse}
            onChange={(e) => setFinalResponse(e.target.value)}
            disabled={isSubmitted || isExpired}
            placeholder="Write your final response here..."
            className="mt-2 min-h-[150px] text-[14px] leading-relaxed"
            rows={6}
          />
          <p className="mt-1 text-right text-[11px] text-[var(--ops-text-muted)]">
            {finalResponse.length} characters
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}
