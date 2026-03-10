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
  priority: "flagship" | "teaser" | "support"
  operatorLabel: string
  heroHeadline: string
  heroDescription: string
  candidateAsk: string
  evidenceHighlights: string[]
  trustHighlights: string[]
  teaserStats: Array<{ label: string; value: string }>
  roundHighlights: string[]
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
    priority: "flagship",
    operatorLabel: "Flagship analyst story",
    heroHeadline: "Turn one KPI anomaly into a decision-ready recommendation with a visible work trace.",
    heroDescription:
      "This is the anchor demo path: short enough to present live, rich enough to show co-design, tool use, evaluation, and governance in one continuous story.",
    candidateAsk:
      "Investigate the paid social conversion drop, verify the root cause, and recommend next actions with explicit caveats and escalation logic.",
    evidenceHighlights: [
      "SQL discrepancy isolation across channels and time windows",
      "Python and R validation before final recommendation",
      "Dashboard annotations plus coach/tool-switching evidence",
      "Verification checkpoints before the candidate commits to an answer",
    ],
    trustHighlights: [
      "Version-locked scoring and rubric provenance",
      "Audit-chain verification with reviewable timeline source",
      "Human-review routing when confidence or policy signals require it",
      "Fairness and red-team hooks ready for employer review",
    ],
    teaserStats: [
      { label: "Rounds", value: "3" },
      { label: "Variants", value: "12" },
      { label: "Evidence", value: "11 events" },
    ],
    roundHighlights: [
      "Round 1: isolate the discrepancy in SQL",
      "Round 2: stress-test the hypothesis in analysis tools",
      "Round 3: deliver the escalation-ready recommendation",
    ],
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
    priority: "support",
    operatorLabel: "Additional simulation",
    heroHeadline: "Data quality triage with explicit ownership and escalation judgment.",
    heroDescription:
      "A shorter operational scenario that proves the platform can score process rigor and documentation quality, not only analytical insight.",
    candidateAsk:
      "Resolve the dashboard vs source mismatch, classify the issue, and produce a clear owner-ready escalation note.",
    evidenceHighlights: [
      "Duplicate vs missing-record decomposition",
      "Lineage reasoning tied to likely ETL stages",
      "Documentation quality with issue logs and references",
      "Escalation severity with owner clarity",
    ],
    trustHighlights: [
      "Traceable SQL checks and reproducible evidence",
      "Explicit rubric for escalation judgment",
      "Clear route into human review when needed",
      "Report surfaces preserve trigger rationale",
    ],
    teaserStats: [
      { label: "Rounds", value: "3" },
      { label: "Focus", value: "Data QA" },
      { label: "Deliverable", value: "Escalation memo" },
    ],
    roundHighlights: [
      "Reconcile source and dashboard row counts",
      "Trace the mismatch to the likely ETL step",
      "Document severity, owner, and next checkpoint",
    ],
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
    priority: "support",
    operatorLabel: "Additional simulation",
    heroHeadline: "Stakeholder ambiguity without hiding behind generic communication advice.",
    heroDescription:
      "A lightweight scenario that highlights assumptions, clarification quality, and escalation judgment when requirements are underspecified.",
    candidateAsk:
      "Respond to a vague stakeholder request by clarifying scope, recording assumptions, and proposing a bounded next-step plan.",
    evidenceHighlights: [
      "Assumption logging and explicit uncertainty handling",
      "Stakeholder-ready writing with clear next actions",
      "Escalation logic when context is incomplete",
      "Decision quality under ambiguity rather than full datasets",
    ],
    trustHighlights: [
      "Visible communication rubric and failure modes",
      "Timeline evidence for clarification vs overconfidence",
      "Trigger rationale available in the report view",
      "Clear distinction between safe inference and unsupported claims",
    ],
    teaserStats: [
      { label: "Duration", value: "10 min" },
      { label: "Focus", value: "Ambiguity" },
      { label: "Primary signal", value: "Judgment" },
    ],
    roundHighlights: [
      "Identify the missing requirements",
      "State assumptions with confidence levels",
      "Draft the escalation-ready response",
    ],
  },
  {
    id: "tpl_customer_support_judgment",
    role: "Customer Support",
    skills: ["policy", "escalation", "writing", "prioritization"],
    title: "Customer Support Escalation Judgment",
    scenario:
      "Prioritize a mixed ticket queue, apply policy correctly, and draft an escalation-ready response without losing empathy.",
    artifacts: [
      { type: "csv", name: "ticket_queue.csv" },
      { type: "md", name: "refund_policy.md" },
      { type: "txt", name: "vip_customer_thread.txt" },
    ],
    description:
      "Simulate queue prioritization, policy judgment, and stakeholder writing under time pressure. Scores escalation quality, written clarity, and decision changes when new evidence arrives.",
    skillTags: ["Policy Judgment", "Escalation", "Empathy", "Written Communication"],
    estimatedDuration: "14 min",
    priority: "support",
    operatorLabel: "Additional simulation",
    heroHeadline: "Operational judgment, policy application, and empathy under queue pressure.",
    heroDescription:
      "A more intuitive non-technical path for mixed audiences that still preserves evidence, rubric scoring, and reviewable governance context.",
    candidateAsk:
      "Prioritize the ticket queue, apply refund policy correctly, and draft an escalation-ready reply without losing empathy.",
    evidenceHighlights: [
      "Ticket prioritization under SLA pressure",
      "Policy application with explicit reasons",
      "Writing quality and escalation note structure",
      "Decision changes when new evidence arrives",
    ],
    trustHighlights: [
      "Policy-aware evaluation instead of keyword matching",
      "Explicit capture of escalation quality and empathy",
      "Review queue integration for sensitive decisions",
      "Audit-ready handling of AI-assisted coaching modes",
    ],
    teaserStats: [
      { label: "Duration", value: "14 min" },
      { label: "Queue", value: "Mixed tickets" },
      { label: "Primary signal", value: "Policy judgment" },
    ],
    roundHighlights: [
      "Prioritize the queue against SLA risk",
      "Apply the right policy without overpromising",
      "Draft the escalation-ready customer response",
    ],
  },
  {
    id: "tpl_doordash_enablement",
    role: "Strategy / Senior Analyst",
    skills: ["sql", "python", "experimentation", "storytelling", "roi"],
    title: "Marketplace Growth Strategy Simulation",
    scenario:
      "Build a strategy to double unmanaged restaurant sales with defensible analysis, SQL proficiency, and a pilot-ready rollout.",
    artifacts: [
      { type: "xlsx", name: "atl_unmanaged_restaurants.xlsx" },
      { type: "docx", name: "sql_add_on_candidate_view.docx" },
      { type: "slides", name: "5_slide_submission_template.pptx" },
    ],
    description:
      "Long-form strategy case: ambiguous marketplace growth problem, SQL/Python diagnostics, ROI modeling, and executive storytelling with a reviewable evidence trail.",
    skillTags: ["SQL", "Python", "Experiment Design", "ROI", "Executive Storytelling"],
    estimatedDuration: "4 weeks",
    priority: "teaser",
    operatorLabel: "Breadth teaser",
    heroHeadline: "Show the same evaluation model scaling from a 15-minute analyst case to a four-week strategy simulation.",
    heroDescription:
      "This is the post-report breadth moment: a long-form marketplace strategy engagement with SQL, ROI modeling, pilot design, and executive defense, without trying to run a second full demo live.",
    candidateAsk:
      "Build a strategy to double unmanaged restaurant sales, define the right proxy metrics, model ROI trade-offs, and defend the rollout with pilot guardrails.",
    evidenceHighlights: [
      "Issue tree, metric taxonomy, and assumption logging",
      "Managed vs unmanaged benchmark plus SQL fluency checks",
      "Pilot design, ROI sensitivity, and go/no-go thresholds",
      "Executive storytelling with a defendable five-slide narrative",
    ],
    trustHighlights: [
      "The same evidence graph extends to long-form work, not just short tasks",
      "Rubric dimensions cover framing, analytical rigor, ROI, and communication",
      "Operator review can compare round performance and coaching traces across weeks",
      "Governance surfaces remain available even as the simulation expands in scope",
    ],
    teaserStats: [
      { label: "Arc", value: "4 weeks" },
      { label: "Parts", value: "4" },
      { label: "Signals", value: "Strategy + ROI" },
    ],
    roundHighlights: [
      "Week 1: frame the problem and audit data quality",
      "Week 2: benchmark the funnel and prove SQL fluency",
      "Week 3: model interventions, pilot design, and ROI",
      "Week 4: defend the deck in executive Q&A",
    ],
  },
]
