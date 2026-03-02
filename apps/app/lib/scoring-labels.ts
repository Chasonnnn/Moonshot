import type { SessionMode } from "@/lib/moonshot/types"

export function getScoringLabel(mode?: SessionMode): { label: string; className: string; warning: string | null } {
  switch (mode) {
    case "assessment_ai_assisted":
      return { label: "AI-Assisted", className: "border-[#FF9F0A]/40 bg-[#FF9F0A]/10 text-[#FF9F0A]", warning: "Not comparable to no-AI baselines" }
    case "assessment_no_ai":
      return { label: "Clean Baseline", className: "border-[#34C759]/40 bg-[#34C759]/10 text-[#34C759]", warning: null }
    case "practice":
      return { label: "Practice (unscored)", className: "border-[#86868B]/40 bg-[#86868B]/10 text-[#86868B]", warning: null }
    default:
      return { label: "Standard", className: "border-[#86868B]/40 bg-[#86868B]/10 text-[#86868B]", warning: null }
  }
}
