"use client"

import { Badge } from "@/components/ui/badge"

const CASE_TEMPLATES = [
  {
    id: "tpl_backend_sr",
    role: "Senior Backend Engineer",
    title: "API Rate Limiter Design",
    scenario:
      "Design and implement a token-bucket rate limiter for a high-traffic API. Evaluate tradeoff between Redis-backed shared state and in-process counters.",
    tags: ["system-design", "backend", "scalability"],
  },
  {
    id: "tpl_data_analyst",
    role: "Data Analyst",
    title: "KPI Discrepancy Investigation",
    scenario: "Find root cause of conversion decline and propose next actions.",
    tags: ["analytics", "sql", "investigation"],
  },
  {
    id: "tpl_fullstack",
    role: "Full-Stack Developer",
    title: "Real-Time Dashboard Feature",
    scenario:
      "Add live-updating metrics to an existing Next.js dashboard. Choose between WebSocket, SSE, or polling and justify the decision.",
    tags: ["frontend", "backend", "real-time"],
  },
  {
    id: "tpl_ml_eng",
    role: "ML Engineer",
    title: "Model Serving Pipeline",
    scenario:
      "Design a serving pipeline for a classification model that handles 500 req/s with P99 latency under 100ms. Address model versioning, A/B testing, and rollback.",
    tags: ["ml-ops", "infrastructure", "latency"],
  },
  {
    id: "tpl_sdet",
    role: "SDET / QA Engineer",
    title: "Test Coverage Gap Analysis",
    scenario:
      "Analyze an existing test suite for a payment processing module. Identify coverage gaps, write missing integration tests, and propose a CI strategy.",
    tags: ["testing", "qa", "ci-cd"],
  },
]

interface CaseTemplatesProps {
  onSelect: (template: { title: string; scenario: string }) => void
}

export function CaseTemplates({ onSelect }: CaseTemplatesProps) {
  return (
    <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
      <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Templates</h2>
      <p className="mt-1 text-[12px] text-[#6E6E73]">Start from a pre-built case template. Click to pre-fill the form below.</p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {CASE_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect({ title: tpl.title, scenario: tpl.scenario })}
            className="flex min-w-[220px] shrink-0 flex-col items-start gap-2 rounded-xl border border-[#E5E5EA] px-4 py-3 text-left transition-colors hover:border-[#0071E3]/40 hover:bg-[#0071E3]/5"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">{tpl.role}</p>
            <p className="text-[13px] font-medium text-[#1D1D1F]">{tpl.title}</p>
            <div className="flex flex-wrap gap-1">
              {tpl.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
