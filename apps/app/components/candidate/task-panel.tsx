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

export function TaskPanel() {
  const { session, isSubmitted, isExpired, finalResponse, setFinalResponse, mode } = useSession()
  const rules = getModeRules(mode)

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
