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
          <CollapsibleTrigger className="flex w-full items-center gap-1 text-[13px] font-medium uppercase tracking-wide text-[#86868B] hover:text-[#1D1D1F]">
            <ChevronRight className="h-3.5 w-3.5 transition-transform [[data-panel-open]_&]:rotate-90" />
            Assessment Rules
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-[#1D1D1F]">
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
              <h3 className="text-[13px] font-medium text-[#86868B] uppercase tracking-wide">
                Current Round
              </h3>
              <p className="mt-2 text-[14px] font-medium text-[#1D1D1F]">
                {currentRound.title} ({currentRoundIndex + 1}/{totalRounds})
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#4D4D52]">
                {currentRound.objective}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-[#1D1D1F]">
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
              <h3 className="text-[13px] font-medium text-[#86868B] uppercase tracking-wide">
                Assessment Parts
              </h3>
              <div className="mt-2 space-y-1">
                {parts.map((part, i) => (
                  <button
                    key={part.id}
                    onClick={() => setActivePart(i)}
                    className={`w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                      i === activePart
                        ? "bg-[#0071E3]/10 font-medium text-[#0071E3]"
                        : "text-[#1D1D1F] hover:bg-[#F5F5F7]"
                    }`}
                  >
                    <span className="text-[11px] text-[#86868B]">Part {i + 1}</span>
                    <br />
                    {part.title}
                  </button>
                ))}
              </div>
              {parts[activePart] && (
                <>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#4D4D52]">
                    {parts[activePart].description}
                  </p>
                  {parts[activePart].time_limit_minutes != null && (
                    <p className={`mt-2 text-[12px] ${isActivePartExpired ? "text-[#FF3B30]" : "text-[#86868B]"}`}>
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
          <h3 className="text-[13px] font-medium text-[#86868B] uppercase tracking-wide">
            Task
          </h3>
          <div className="mt-2 text-[15px] leading-relaxed text-[#1D1D1F]">
            {session.task_prompt}
          </div>
        </div>

        <Separator />

        <div>
          <label
            htmlFor="final-response"
            className="text-[13px] font-medium text-[#86868B] uppercase tracking-wide"
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
          <p className="mt-1 text-right text-[11px] text-[#86868B]">
            {finalResponse.length} characters
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}
