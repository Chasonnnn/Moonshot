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
      <header className="sticky top-0 z-50 border-b border-[var(--ops-border,#d7e0e4)] bg-white/88 backdrop-blur-xl">
        <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:h-12 md:flex-nowrap md:px-4 md:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-[15px] font-semibold text-[var(--ops-text,#1d1d1f)]">
              M
            </span>
            <span className="text-[13px] text-[var(--ops-text-subtle,#64748b)]">Moonshot</span>
          </div>

          <div className="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 md:order-2 md:w-auto md:justify-center md:pb-0">
            {isSubmitted ? (
              <Badge className="min-h-8 border-[var(--ops-success)]/30 bg-[var(--ops-success-soft)] px-3 text-[12px] text-[var(--ops-success)] md:min-h-5 md:px-2">
                Submitted
              </Badge>
            ) : (
              <Badge variant="outline" className="min-h-8 border-[var(--ops-border-strong)] bg-white px-3 text-[12px] text-[var(--ops-text-muted)] md:min-h-5 md:px-2">
                Active
              </Badge>
            )}

            <Badge className={`min-h-8 px-3 text-[12px] ${badgeConfig.className} md:min-h-5 md:px-2`}>
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

          <div className="order-2 ml-auto md:order-3 md:ml-0">
            {isSubmitted ? null : (
              <Button
                onClick={onSubmit}
                className="h-11 rounded-full bg-[var(--ops-accent,#2563eb)] px-5 text-[14px] text-white hover:bg-[var(--ops-accent-strong,#1d4ed8)] md:h-8 md:px-4 md:text-[13px]"
              >
                Submit
              </Button>
            )}
          </div>
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
