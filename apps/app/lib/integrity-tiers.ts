export type IntegrityTier = "light" | "standard" | "strict"

export interface IntegrityTierConfig {
  label: string
  description: string
  visibleEventTypes: string[]
}

export const INTEGRITY_TIER_PRESETS: Record<IntegrityTier, IntegrityTierConfig> = {
  light: {
    label: "Light",
    description: "Session lifecycle events only. Minimal monitoring.",
    visibleEventTypes: ["session_started", "session_submitted"],
  },
  standard: {
    label: "Standard",
    description: "Lifecycle, tool usage, and AI interaction events.",
    visibleEventTypes: [
      "session_started",
      "session_submitted",
      "sql_query_run",
      "verification_step_completed",
      "copilot_invoked",
    ],
  },
  strict: {
    label: "Strict",
    description: "All events including integrity signals like tab switching and clipboard.",
    visibleEventTypes: [
      "session_started",
      "session_submitted",
      "sql_query_run",
      "verification_step_completed",
      "copilot_invoked",
      "tab_blur_detected",
      "copy_paste_detected",
    ],
  },
}

export function getVisibleEventTypes(tier: IntegrityTier): string[] {
  return INTEGRITY_TIER_PRESETS[tier].visibleEventTypes
}
