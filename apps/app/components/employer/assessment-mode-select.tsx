"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SessionMode } from "@/lib/moonshot/types"

const modeOptions: { value: SessionMode; label: string }[] = [
  { value: "practice", label: "Practice" },
  { value: "assessment", label: "Assessment" },
  { value: "assessment_no_ai", label: "No AI" },
  { value: "assessment_ai_assisted", label: "AI-Assisted" },
]

interface AssessmentModeSelectProps {
  value: SessionMode
  onChange: (mode: SessionMode) => void
}

export function AssessmentModeSelect({ value, onChange }: AssessmentModeSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SessionMode)}>
      <SelectTrigger className="h-8 text-[13px]">
        <SelectValue placeholder="Select mode" />
      </SelectTrigger>
      <SelectContent>
        {modeOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
