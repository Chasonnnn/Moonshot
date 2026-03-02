export interface DemoCaseTemplate {
  id: string
  role: string
  skills: string[]
  title: string
  scenario: string
  artifacts: Array<{ type: string; name: string }>
  description: string
  skillTags: string[]
  estimatedDuration: string
}

export const DEMO_CASE_TEMPLATES: DemoCaseTemplate[] = [
  {
    id: "tpl_data_analyst",
    role: "Data Analyst",
    skills: ["sql", "analytics", "investigation"],
    title: "KPI Discrepancy Investigation",
    scenario: "Find root cause of conversion decline and propose next actions with uncertainty caveats.",
    artifacts: [
      { type: "csv", name: "funnel_weekly.csv" },
      { type: "md", name: "tracking_notes.md" },
    ],
    description: "Investigate a sudden 18% conversion drop using funnel data. Requires segmentation, root cause analysis, and communicating findings with appropriate caveats.",
    skillTags: ["SQL", "Analytics", "Root Cause Analysis", "Communication"],
    estimatedDuration: "15 min",
  },
  {
    id: "tpl_jda_quality",
    role: "Junior Data Analyst",
    skills: ["sql", "dashboard", "qa"],
    title: "SQL Data Quality Triage",
    scenario: "Resolve conflicting row counts between source and dashboard before stakeholder escalation.",
    artifacts: [
      { type: "csv", name: "orders.csv" },
      { type: "csv", name: "customers.csv" },
      { type: "log", name: "etl_log.txt" },
    ],
    description: "Investigate a row count mismatch between source data and a dashboard. Requires systematic data quality investigation and clear documentation of findings.",
    skillTags: ["SQL", "Data Quality", "ETL Debugging", "Documentation"],
    estimatedDuration: "12 min",
  },
  {
    id: "tpl_jda_ambiguity",
    role: "Junior Data Analyst",
    skills: ["communication", "assumptions", "escalation"],
    title: "Stakeholder Ambiguity Handling",
    scenario: "Respond to a vague stakeholder request with clear assumptions, checks, and escalation logic.",
    artifacts: [
      { type: "txt", name: "request_thread.txt" },
      { type: "csv", name: "metric_dictionary.csv" },
    ],
    description: "Handle an ambiguous request from a VP. Requires identifying ambiguities, stating assumptions explicitly, and responding professionally with a clear deliverable plan.",
    skillTags: ["Communication", "Assumptions", "Stakeholder Management"],
    estimatedDuration: "10 min",
  },
]
