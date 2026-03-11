"use client"

import { Badge } from "@/components/ui/badge"
import type { DemoCaseTemplate } from "@/lib/moonshot/demo-case-templates"

interface DemoTemplateCardProps {
  template: DemoCaseTemplate
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}

const TOOL_LABELS: Record<string, string> = {
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
  const priorityStyles =
    template.priority === "flagship"
      ? "border-[#2563EB]/25 bg-[#2563EB]/[0.06] text-[#1E3A8A]"
      : template.priority === "teaser"
        ? "border-[#0F766E]/25 bg-[#0F766E]/[0.06] text-[#115E59]"
        : "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]"
  const workspaceLabels = [...new Set(template.workspaceModes.map((mode) => TOOL_LABELS[mode] ?? mode))]

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${
        selected
          ? "border-[#2563EB] bg-[#EFF6FF] shadow-[0_20px_40px_rgba(37,99,235,0.12)]"
          : "border-[#E2E8F0] bg-white hover:border-[#94A3B8] hover:shadow-[0_18px_32px_rgba(15,23,42,0.08)]"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ops-text-muted)]">
              {template.role} Work Simulation
            </p>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${priorityStyles}`}>
              {template.operatorLabel}
            </span>
          </div>
          <h3 className="mt-1 text-[15px] font-semibold text-[#1D1D1F]">
            {template.title}
          </h3>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[#0F172A]">
            {template.heroHeadline}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E6E73]">
            {template.description}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">
            {template.heroDescription}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[12px] text-[#475569]">
          {template.estimatedDuration}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {template.teaserStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ops-text-muted)]">{stat.label}</p>
            <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ops-text-muted)]">Workspace mix</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {workspaceLabels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="border-[#BFDBFE] bg-[#EFF6FF] text-[11px] font-medium text-[#1E3A8A]"
            >
              {label}
            </Badge>
          ))}
          {template.requiresOralDefense && !workspaceLabels.includes("Oral") ? (
            <Badge variant="outline" className="border-[#BBF7D0] bg-[#F0FDF4] text-[11px] font-medium text-[#15803D]">
              Oral
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.skillTags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="border-[#CBD5E1] bg-white text-[11px] font-normal text-[#334155]"
          >
            {tag}
          </Badge>
        ))}
      </div>
    </button>
  )
}
