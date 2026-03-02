"use client"

import { useState } from "react"
import { useSession } from "@/components/candidate/session-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { SessionMode } from "@/lib/moonshot/types"

const MODE_LABELS: Record<SessionMode, string> = {
  practice: "Practice",
  assessment: "Assessment",
  assessment_no_ai: "No AI",
  assessment_ai_assisted: "AI-Assisted",
}

const MODE_COLORS: Record<SessionMode, string> = {
  practice: "bg-green-100 text-green-800",
  assessment: "bg-orange-100 text-orange-800",
  assessment_no_ai: "bg-red-100 text-red-800",
  assessment_ai_assisted: "bg-blue-100 text-blue-800",
}

export function getModeRules(mode: SessionMode): string[] {
  switch (mode) {
    case "practice":
      return ["This is a practice session. Results are not scored."]
    case "assessment":
      return ["This is a scored assessment."]
    case "assessment_no_ai":
      return [
        "This is a scored assessment.",
        "AI assistance is disabled. The coach panel will be locked.",
      ]
    case "assessment_ai_assisted":
      return [
        "This is a scored assessment.",
        "AI assistance is available. Scores are labeled as AI-assisted.",
      ]
  }
}

const CHECKLIST_ITEMS = [
  "I understand the assessment rules",
  "I have a stable internet connection",
  "I am ready to begin",
] as const

export function SessionPreflight({ onReady }: { onReady: () => void }) {
  const { session, mode } = useSession()
  const [checked, setChecked] = useState<boolean[]>([false, false, false])

  const allChecked = checked.every(Boolean)
  const rules = getModeRules(mode)
  const timeLimit = session.policy.time_limit_minutes
  const retentionDays = session.policy.retention_ttl_days

  function toggleCheck(index: number) {
    setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Badge
            className={`mx-auto mb-3 w-fit ${MODE_COLORS[mode]}`}
            variant="outline"
          >
            {MODE_LABELS[mode]}
          </Badge>
          <CardTitle className="text-xl font-semibold text-[#1D1D1F]">
            Assessment Preflight
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[#86868B]">
              Time Limit
            </p>
            <p className="text-[15px] text-[#1D1D1F]">
              {timeLimit != null ? `${timeLimit} minutes` : "No time limit"}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[#86868B]">
              Rules
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[15px] text-[#1D1D1F]">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[#86868B]">
              Data Retention
            </p>
            <p className="text-[15px] text-[#1D1D1F]">
              Your session data will be retained for {retentionDays} days.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[#86868B]">
              Readiness Checklist
            </p>
            {CHECKLIST_ITEMS.map((label, i) => (
              <label
                key={label}
                className="flex cursor-pointer items-center gap-3 text-[15px] text-[#1D1D1F]"
              >
                <Checkbox
                  checked={checked[i]}
                  onCheckedChange={() => toggleCheck(i)}
                />
                {label}
              </label>
            ))}
          </div>

          <Button
            className="h-10 w-full bg-[#0071E3] text-white hover:bg-[#0077ED]"
            disabled={!allChecked}
            onClick={onReady}
          >
            Begin Assessment
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
