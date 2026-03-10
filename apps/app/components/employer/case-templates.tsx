"use client"

import { Badge } from "@/components/ui/badge"
import { DEMO_CASE_TEMPLATES } from "@/lib/moonshot/demo-case-templates"

interface CaseTemplatesProps {
  onSelect: (template: { title: string; scenario: string }) => void
}

export function CaseTemplates({ onSelect }: CaseTemplatesProps) {
  return (
    <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
      <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Work Simulation Templates</h2>
      <p className="mt-1 text-[12px] text-[#6E6E73]">Start from a pre-built role simulation. Click to pre-fill the form below.</p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {DEMO_CASE_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect({ title: tpl.title, scenario: tpl.scenario })}
            className="flex min-w-[220px] shrink-0 flex-col items-start gap-2 rounded-xl border border-[#E5E5EA] px-4 py-3 text-left transition-colors hover:border-[#0071E3]/40 hover:bg-[#0071E3]/5"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">{tpl.role}</p>
            <p className="text-[13px] font-medium text-[#1D1D1F]">{tpl.title}</p>
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
