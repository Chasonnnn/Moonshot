"use client"

import type { DemoCaseTemplate } from "@/lib/moonshot/demo-case-templates"
import { cn } from "@/lib/utils"

interface DemoTemplateCardProps {
  template: DemoCaseTemplate
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}

export const TOOL_LABELS: Record<string, string> = {
  sql: "SQL",
  python: "Analysis",
  r: "R",
  dashboard: "Dashboard",
  spreadsheet: "Spreadsheet",
  bi: "BI",
  slides: "Slides",
  oral: "Oral",
}

export function DemoTemplateCard({ template, selected, onSelect, disabled }: DemoTemplateCardProps) {
  const workspaceLabels = [...new Set(template.workspaceModes.map((mode) => TOOL_LABELS[mode] ?? mode))]

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-expanded={selected}
      className={cn(
        "w-full rounded-xl border text-left transition-colors",
        selected
          ? "border-[var(--ops-accent)] bg-[var(--ops-accent)]/5"
          : "border-[var(--ops-border)] bg-white hover:border-[var(--ops-text-muted)]/40",
        disabled && "cursor-not-allowed opacity-60",
        selected ? "p-4" : "p-3.5",
      )}
    >
      {/* Compact header — always visible */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-semibold text-[var(--ops-text)]">{template.title}</h4>
        <span className="shrink-0 text-[11px] text-[var(--ops-text-muted)]">{template.estimatedDuration}</span>
      </div>
      <p className={cn("mt-1 text-[12px] leading-relaxed text-[var(--ops-text-muted)]", !selected && "line-clamp-2")}>
        {template.heroHeadline}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {workspaceLabels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-[var(--ops-border)] px-2 py-0.5 text-[10px] text-[var(--ops-text-muted)]"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Expanded detail — only when selected */}
      {selected ? (
        <div className="mt-3 border-t border-[var(--ops-border)] pt-3">
          <p className="text-[12px] leading-relaxed text-[var(--ops-text-muted)]">{template.description}</p>
          <div className="mt-2.5 flex flex-wrap gap-3 text-[12px] text-[var(--ops-text-muted)]">
            {template.teaserStats.map((stat) => (
              <span key={stat.label}>
                <span className="font-medium text-[var(--ops-text)]">{stat.value}</span>{" "}
                {stat.label.toLowerCase()}
              </span>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {template.skillTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--ops-border)] px-2 py-0.5 text-[10px] text-[var(--ops-text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </button>
  )
}
