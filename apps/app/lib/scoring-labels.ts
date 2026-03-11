import type { SessionMode } from "@/lib/moonshot/types"

export function getScoringLabel(mode?: SessionMode): { label: string; className: string; warning: string | null } {
  switch (mode) {
    case "assessment_ai_assisted":
      return { label: "AI-Assisted", className: "border-[var(--ops-warning)]/30 bg-[var(--ops-warning-soft)] text-[var(--ops-warning)]", warning: "Not comparable to no-AI baselines" }
    case "assessment_no_ai":
      return { label: "Clean Baseline", className: "border-[var(--ops-success)]/30 bg-[var(--ops-success-soft)] text-[var(--ops-success)]", warning: null }
    case "practice":
      return { label: "Practice (unscored)", className: "border-[var(--ops-border-strong)] bg-[var(--ops-surface-muted)] text-[var(--ops-text-muted)]", warning: null }
    default:
      return { label: "Standard", className: "border-[var(--ops-border-strong)] bg-[var(--ops-surface-muted)] text-[var(--ops-text-muted)]", warning: null }
  }
}
