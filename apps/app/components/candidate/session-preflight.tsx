"use client"

import { useState } from "react"
import { useSession } from "@/components/candidate/session-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
    <main className="flex min-h-screen items-center justify-center bg-[var(--ops-page-bg,#f5f5f7)] px-4 py-6 sm:px-6">
      <Card className="w-full max-w-xl border-[var(--ops-border,#d7e0e4)] bg-[var(--ops-surface,#ffffff)] shadow-[0_24px_56px_rgba(15,23,42,0.08)]">
        <CardHeader className="text-center">
          <Badge
            className={`mx-auto mb-3 w-fit rounded-full px-3 py-1 ${MODE_COLORS[mode]}`}
            variant="outline"
          >
            {MODE_LABELS[mode]}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ops-text,#1d1d1f)]">
            Assessment Preflight
          </h1>
          <p className="text-sm text-[var(--ops-text-muted,#64748b)]">
            Confirm the session rules and your setup before the assessment begins.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle,#64748b)]">
              Time Limit
            </p>
            <p className="text-[15px] text-[var(--ops-text,#1d1d1f)]">
              {timeLimit != null ? `${timeLimit} minutes` : "No time limit"}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle,#64748b)]">
              Rules
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[15px] text-[var(--ops-text,#1d1d1f)]">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle,#64748b)]">
              Data Retention
            </p>
            <p className="text-[15px] text-[var(--ops-text,#1d1d1f)]">
              Your session data will be retained for {retentionDays} days.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle,#64748b)]">
              Readiness Checklist
            </p>
            {CHECKLIST_ITEMS.map((label, i) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-2xl border border-[var(--ops-border,#d7e0e4)] bg-[var(--ops-surface-subtle,#f8fafc)] px-4 py-3"
              >
                <Checkbox
                  id={`preflight-check-${i}`}
                  aria-labelledby={`preflight-check-label-${i}`}
                  checked={checked[i]}
                  onCheckedChange={() => toggleCheck(i)}
                  className="mt-0.5 size-5 rounded-[8px]"
                />
                <label
                  id={`preflight-check-label-${i}`}
                  htmlFor={`preflight-check-${i}`}
                  className="min-w-0 cursor-pointer text-[15px] leading-6 text-[var(--ops-text,#1d1d1f)]"
                >
                  {label}
                </label>
              </div>
            ))}
          </div>

          <Button
            className="h-11 w-full bg-[var(--ops-accent,#2563eb)] text-white hover:bg-[var(--ops-accent-strong,#1d4ed8)]"
            disabled={!allChecked}
            onClick={onReady}
          >
            Begin Assessment
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
