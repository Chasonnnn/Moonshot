"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  INTEGRITY_TIER_PRESETS,
  type IntegrityTier,
} from "@/lib/integrity-tiers"

const tiers: IntegrityTier[] = ["light", "standard", "strict"]

interface IntegrityTierSelectProps {
  value: IntegrityTier
  onChange: (tier: IntegrityTier) => void
}

export function IntegrityTierSelect({ value, onChange }: IntegrityTierSelectProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as IntegrityTier)}
      className="grid gap-3"
    >
      {tiers.map((tier) => {
        const config = INTEGRITY_TIER_PRESETS[tier]
        const isSelected = value === tier
        return (
          <label
            key={tier}
            className="flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors"
            style={{
              borderColor: isSelected ? "#0071E3" : "#D2D2D7",
              backgroundColor: isSelected ? "#F0F5FF" : "#FFFFFF",
            }}
          >
            <RadioGroupItem
              value={tier}
              aria-label={config.label}
              className="mt-0.5"
            />
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: "#1D1D1F" }}
              >
                {config.label}
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "#86868B" }}
              >
                {config.description}
              </div>
            </div>
          </label>
        )
      })}
    </RadioGroup>
  )
}
