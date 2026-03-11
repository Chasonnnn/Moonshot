"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSession } from "@/components/candidate/session-context"
import type { SessionMode } from "@/lib/moonshot/types"

const modeBadgeConfig: Record<SessionMode, { label: string; className: string }> = {
  practice: { label: "Practice", className: "border-[var(--ops-border-strong)] bg-[var(--ops-surface-muted)] text-[var(--ops-text-muted)]" },
  assessment: { label: "Assessment", className: "border-[var(--ops-accent)]/30 bg-[var(--ops-accent-soft)] text-[var(--ops-accent-strong)]" },
  assessment_no_ai: { label: "No AI", className: "border-[var(--ops-warning)]/30 bg-[var(--ops-warning-soft)] text-[var(--ops-warning)]" },
  assessment_ai_assisted: { label: "AI-Assisted", className: "border-[#7c3aed]/30 bg-[#f5f3ff] text-[#6d28d9]" },
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function SessionHeader({ onSubmit }: { onSubmit: () => void }) {
  const { isSubmitted, remainingSeconds, isExpired, mode } = useSession()
  const badgeConfig = modeBadgeConfig[mode]

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[var(--ops-border,#d7e0e4)] bg-white/88 px-3 backdrop-blur-xl md:h-12 md:px-4">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[var(--ops-text,#1d1d1f)]">
            M
          </span>
          <span className="text-[13px] text-[var(--ops-text-subtle,#64748b)]">Moonshot</span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {isSubmitted ? (
            <Badge className="border-[var(--ops-success)]/30 bg-[var(--ops-success-soft)] text-[var(--ops-success)]">
              Submitted
            </Badge>
          ) : (
            <Badge variant="outline" className="border-[var(--ops-border-strong)] bg-white text-[var(--ops-text-muted)]">
              Active
            </Badge>
          )}

          <Badge className={`${badgeConfig.className} hidden sm:inline-flex`}>
            {badgeConfig.label}
          </Badge>

          {remainingSeconds !== null && (
            <span
              className={`font-mono text-[13px] tabular-nums ${
                remainingSeconds <= 60
                  ? "text-[#D70015] font-semibold animate-pulse"
                  : remainingSeconds <= 300
                    ? "text-[#FF9F0A] font-medium"
                    : "text-[var(--ops-text-subtle,#64748b)]"
              }`}
            >
              {formatTime(remainingSeconds)}
            </span>
          )}
        </div>

        <div>
          {isSubmitted ? (
            <Badge className="border-[var(--ops-success)]/30 bg-[var(--ops-success-soft)] text-[var(--ops-success)]">
              Submitted
            </Badge>
          ) : (
            <Button
              onClick={onSubmit}
              className="h-11 rounded-full bg-[var(--ops-accent,#2563eb)] px-4 text-[13px] text-white hover:bg-[var(--ops-accent-strong,#1d4ed8)] md:h-8"
            >
              Submit
            </Button>
          )}
        </div>
      </header>

      {isExpired && !isSubmitted && (
        <div className="border-b border-[var(--ops-warning,#d97706)] bg-[var(--ops-warning-soft,#fff7ed)] px-4 py-2 text-center text-[13px] text-[var(--ops-warning,#d97706)]">
          Time has expired. Please submit your response.
        </div>
      )}
    </>
  )
}
