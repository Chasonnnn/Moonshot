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
    description: "Lifecycle, workflow progression, tool usage, and AI interaction events.",
    visibleEventTypes: [
      "session_started",
      "session_submitted",
      "co_design_started",
      "co_design_completed",
      "task_generation_completed",
      "round_started",
      "round_completed",
      "sql_query_run",
      "python_run",
      "analysis_r_run",
      "dashboard_action",
      "verification_step_completed",
      "stakeholder_recommendation_submitted",
      "copilot_invoked",
    ],
  },
  strict: {
    label: "Strict",
    description: "All events including workflow telemetry and integrity signals like tab switching and clipboard.",
    visibleEventTypes: [
      "session_started",
      "session_submitted",
      "co_design_started",
      "co_design_completed",
      "task_generation_completed",
      "round_started",
      "round_completed",
      "sql_query_run",
      "python_run",
      "analysis_r_run",
      "dashboard_action",
      "verification_step_completed",
      "stakeholder_recommendation_submitted",
      "copilot_invoked",
      "tab_blur_detected",
      "copy_paste_detected",
    ],
  },
}

export function getVisibleEventTypes(tier: IntegrityTier): string[] {
  return INTEGRITY_TIER_PRESETS[tier].visibleEventTypes
}
