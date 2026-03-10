"use client"

import { Badge } from "@/components/ui/badge"
import { DEMO_CASE_TEMPLATES } from "@/lib/moonshot/demo-case-templates"

interface CaseTemplatesProps {
  onSelect: (template: { title: string; scenario: string }) => void
}

export function CaseTemplates({ onSelect }: CaseTemplatesProps) {
  return (
    <div className="ops-surface p-6">
      <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Work Simulation Templates</h2>
      <p className="mt-1 text-[12px] text-[var(--ops-text-subtle)]">Start from a pre-built role simulation. Click to pre-fill the form below.</p>
      <div
        className="ops-scroll-region mt-4 flex gap-3 overflow-x-auto pb-2"
        role="region"
        aria-label="Work simulation templates"
        tabIndex={0}
      >
        {DEMO_CASE_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect({ title: tpl.title, scenario: tpl.scenario })}
            className="ops-surface-soft flex min-h-11 min-w-[220px] shrink-0 flex-col items-start gap-2 px-4 py-3 text-left transition-colors hover:border-[color:color-mix(in_srgb,var(--ops-accent)_42%,white)] hover:bg-[color:color-mix(in_srgb,var(--ops-accent-soft)_45%,white)]"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ops-text-subtle)]">{tpl.role}</p>
            <p className="text-[13px] font-medium text-[var(--ops-text)]">{tpl.title}</p>
            <div className="flex flex-wrap gap-1">
              {tpl.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
