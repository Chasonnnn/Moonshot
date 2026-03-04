"use client"

import { Badge } from "@/components/ui/badge"
import type { DemoCaseTemplate } from "@/lib/moonshot/demo-case-templates"

interface DemoTemplateCardProps {
  template: DemoCaseTemplate
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}

export function DemoTemplateCard({ template, selected, onSelect, disabled }: DemoTemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${
        selected
          ? "border-[#0071E3] bg-[#0071E3]/5 shadow-sm"
          : "border-[#E5E5EA] bg-white hover:border-[#D2D2D7] hover:shadow-sm"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">
            {template.role}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-[#1D1D1F]">
            {template.title}
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E6E73]">
            {template.description}
          </p>
          <p className="mt-2 text-[12px] text-[#4D4D52]">
            Includes co-design loop, multi-round candidate simulation, and detailed evaluation dashboard.
          </p>
        </div>
        <span className="shrink-0 text-[12px] text-[#86868B]">
          {template.estimatedDuration}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.skillTags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-[11px] font-normal"
          >
            {tag}
          </Badge>
        ))}
      </div>
    </button>
  )
}
