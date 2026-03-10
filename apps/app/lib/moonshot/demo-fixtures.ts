export interface DemoCoachTurn {
  role: "user" | "coach"
  content: string
  allowed: boolean
  policyReason?: string
}

export interface DemoSqlQuery {
  query: string
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface DemoPythonScript {
  code: string
  stdout: string
  plotUrl?: string
  datasetId?: string
}

export interface DemoEventEntry {
  event_type: string
  payload: Record<string, unknown>
}

export interface DemoMockScoreResult {
  confidence: number
  dimensionScores: Record<string, number>
  triggerCodes: string[]
}

export interface DemoRubricDimension {
  key: string
  anchor: string
  evaluationPoints: string[]
  evidenceSignals: string[]
  commonFailureModes: string[]
  scoreBands: Record<string, string>
}

export interface DemoVariantCatalogItem {
  id: string
  skill: string
  difficultyLevel: string
  roundHint: string
  promptSummary: string
  deliverables: string[]
  estimatedMinutes: number
  artifactRefs: string[]
}

export interface DemoDifficultyLevel {
  level: string
  focus: string
  expectation: string
}

export interface DemoCoDesignBundle {
  roleStatement: string
  objectives: string[]
  sampleTasks: string[]
  rubricBlueprint: string[]
  difficultyLadder: DemoDifficultyLevel[]
  agentNotes: string[]
}

export interface DemoRound {
  id: string
  title: string
  objective: string
  deliverables: string[]
  sqlQueries: DemoSqlQuery[]
  pythonScripts: DemoPythonScript[]
  rScripts: DemoPythonScript[]
  dashboardActions: string[]
  coachScript: DemoCoachTurn[]
  mockedArtifacts: string[]
}

export interface DemoEvaluationBundle {
  coDesignAlignment: Array<{ dimension: string; score: number; note: string }>
  roundPerformance: Array<{ round: string; score: number; note: string }>
  toolProficiency: Array<{ tool: "sql" | "python" | "r" | "dashboard"; score: number }>
  triggerRationale: Array<{ code: string; rationale: string; impact: string }>
  agentNarrative: string[]
}

export interface DemoDatasetColumn {
  name: string
  dtype: string
  description: string
  sample_values: string[]
}

export interface DemoDatasetSchema {
  columns: DemoDatasetColumn[]
}

export interface DemoDataset {
  id: string
  name: string
  description: string
  row_count: number
  schema: DemoDatasetSchema
  preview_rows: Record<string, unknown>[]
}

export interface DemoPart {
  id: string
  title: string
  description: string
  part_type?: string
  time_limit_minutes?: number
  deliverable_type?: string
}

export interface DemoFixtureData {
  jobDescription: string
  taskPrompt: string
  coDesignBundle: DemoCoDesignBundle
  rubric: DemoRubricDimension[]
  variantCatalog: DemoVariantCatalogItem[]
  rounds: DemoRound[]
  sqlQueries: DemoSqlQuery[]
  pythonScripts: DemoPythonScript[]
  coachScript: DemoCoachTurn[]
  finalResponse: string
  sampleEvents: DemoEventEntry[]
  mockScoreResult: DemoMockScoreResult
  evaluationBundle: DemoEvaluationBundle
  datasets: DemoDataset[]
  parts: DemoPart[]
}

const DEFAULT_DIFFICULTY_LADDER: DemoDifficultyLevel[] = [
  {
    level: "Foundation",
    focus: "Data integrity basics",
    expectation: "Establish baseline checks and data-shape validation.",
  },
  {
    level: "Intermediate",
    focus: "Cross-system reconciliation",
    expectation: "Connect SQL checks to business metrics with traceable evidence.",
  },
  {
    level: "Advanced",
    focus: "Root-cause and risk framing",
    expectation: "Prioritize hypotheses, test alternatives, and state uncertainty.",
  },
  {
    level: "Capstone",
    focus: "Executive-ready decisioning",
    expectation: "Deliver final recommendation, impact, and escalation plan.",
  },
]

function buildVariantCatalog(basePrompt: string, skills: string[]): DemoVariantCatalogItem[] {
  const difficulties = [
    "Foundation",
    "Foundation",
    "Intermediate",
    "Intermediate",
    "Intermediate",
    "Advanced",
    "Advanced",
    "Advanced",
    "Expert",
    "Expert",
    "Expert",
    "Capstone",
  ]

  return difficulties.map((difficulty, index) => {
    const skill = skills[index % skills.length]
    const roundHint = `round_${(index % 3) + 1}`
    return {
      id: `var_${index + 1}`,
      skill,
      difficultyLevel: difficulty,
      roundHint,
      promptSummary: `${basePrompt} Focus on ${skill} evidence under ${difficulty.toLowerCase()} constraints.`,
      deliverables: ["analysis_summary", "evidence_table", "recommended_actions"],
      estimatedMinutes: 12 + (index % 4) * 4,
      artifactRefs: ["orders.csv", "etl_log.txt", "dashboard_snapshot.png"],
    }
  })
}

function buildEvaluationBundle(
  coDesignAlignment: Array<{ dimension: string; score: number; note: string }>,
  roundPerformance: Array<{ round: string; score: number; note: string }>,
  toolProficiency: Array<{ tool: "sql" | "python" | "r" | "dashboard"; score: number }>,
  triggerRationale: Array<{ code: string; rationale: string; impact: string }>,
  agentNarrative: string[],
): DemoEvaluationBundle {
  return {
    coDesignAlignment,
    roundPerformance,
    toolProficiency,
    triggerRationale,
    agentNarrative,
  }
}

const DATA_ANALYST_VARIANTS = buildVariantCatalog(
  "Investigate the conversion drop, prove root cause, and propose an action plan with caveats.",
  ["sql", "python", "dashboard", "analysis"],
)

const JDA_QUALITY_VARIANTS = buildVariantCatalog(
  "Resolve source/dashboard mismatch and determine ETL bug vs data-quality condition.",
  ["sql", "dashboard", "documentation", "qa"],
)

const JDA_AMBIGUITY_VARIANTS = buildVariantCatalog(
  "Handle ambiguous stakeholder ask by clarifying scope and delivering a bounded recommendation.",
  ["communication", "assumptions", "escalation", "analysis"],
)

const CUSTOMER_SUPPORT_VARIANTS = buildVariantCatalog(
  "Prioritize a ticket queue, apply policy correctly, and communicate a calm escalation path under time pressure.",
  ["prioritization", "policy", "escalation", "writing"],
).map((item) => ({
  ...item,
  deliverables: ["priority_queue", "customer_reply", "escalation_note"],
  artifactRefs: ["ticket_queue.csv", "refund_policy.md", "vip_customer_thread.txt"],
}))

const DATA_ANALYST_ROUNDS: DemoRound[] = [
  {
    id: "round_1",
    title: "Round 1 - SQL discrepancy triage",
    objective: "Validate where conversion loss occurs and isolate the impacted segment.",
    deliverables: ["Root-cause hypothesis", "Supporting SQL evidence"],
    sqlQueries: [
      {
        query: "SELECT week, stage, conversion_rate FROM funnel_weekly ORDER BY week DESC LIMIT 10;",
        columns: ["week", "stage", "conversion_rate"],
        rows: [
          { week: "2026-02-23", stage: "signup_to_activation", conversion_rate: 0.34 },
          { week: "2026-02-23", stage: "activation_to_purchase", conversion_rate: 0.42 },
          { week: "2026-02-16", stage: "signup_to_activation", conversion_rate: 0.41 },
          { week: "2026-02-16", stage: "activation_to_purchase", conversion_rate: 0.51 },
        ],
      },
      {
        query: "SELECT channel, AVG(conversion_rate) AS avg_conv FROM funnel_weekly WHERE week='2026-02-23' GROUP BY channel;",
        columns: ["channel", "avg_conv"],
        rows: [
          { channel: "organic", avg_conv: 0.38 },
          { channel: "paid_social", avg_conv: 0.22 },
          { channel: "email", avg_conv: 0.51 },
        ],
      },
    ],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Filter channel=paid_social", "Open conversion trend chart", "Add annotation: suspected channel-quality issue"],
    coachScript: [
      { role: "user", content: "I found paid social dropped the most. What should I verify next?", allowed: true },
      {
        role: "coach",
        content: "Validate whether the drop is rate-only or volume-plus-rate. Compare with adjacent weeks before committing.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["funnel_slice_paid_social.csv", "query_result_round1.md"],
  },
  {
    id: "round_2",
    title: "Round 2 - Python/R analytical deepening",
    objective: "Quantify impact and stress-test assumptions with analysis scripts.",
    deliverables: ["Analytical summary", "Mocked chart evidence"],
    sqlQueries: [],
    pythonScripts: [
      {
        code: 'import pandas as pd\n\ndf = pd.read_csv(DATASET_PATH)\nlatest = df[df["week"] == "2026-02-23"][["channel", "conversion_rate"]]\nprint(latest.sort_values("conversion_rate"))',
        stdout: "       channel  conversion_rate\n5  paid_social             0.22\n2      organic             0.38\n8        email             0.51",
        datasetId: "conversion_channels_v1",
      },
      {
        code: 'import pandas as pd\nimport matplotlib.pyplot as plt\n\ndf = pd.read_csv(DATASET_PATH)\npaid = df[df["channel"] == "paid_social"]\nplt.plot(paid["week"], paid["conversion_rate"], marker="o")\nplt.title("Paid Social Conversion")\nplt.xlabel("Week")\nplt.ylabel("Conversion Rate")\nplt.show()',
        stdout: "",
        plotUrl: "/runtime/plot_1.png",
        datasetId: "conversion_channels_v1",
      },
    ],
    rScripts: [
      {
        code: 'library(ggplot2)\ndf <- data.frame(week=c("02-09","02-16","02-23"), conv=c(0.44,0.45,0.22))\nprint(summary(df$conv))',
        stdout: "   Min. 1st Qu.  Median    Mean 3rd Qu.    Max.\n 0.2200  0.3300  0.4400  0.3700  0.4450  0.4500",
        plotUrl: "/mock/r-trend-plot.png",
      },
    ],
    dashboardActions: ["Overlay campaign launch timeline", "Annotate likely targeting drift"],
    coachScript: [
      { role: "user", content: "Can I conclude campaign quality is the cause?", allowed: true },
      {
        role: "coach",
        content: "State it as a leading hypothesis and show what evidence would falsify it. Keep one alternative cause in scope.",
        allowed: true,
      },
      {
        role: "user",
        content: "Can you write the final SQL for me?",
        allowed: false,
        policyReason: "Direct answer requests are blocked in assessment mode.",
      },
    ],
    mockedArtifacts: ["channel_trend.png", "r_distribution_summary.txt"],
  },
  {
    id: "round_3",
    title: "Round 3 - Dashboard recommendation and escalation",
    objective: "Prepare executive-ready recommendation with risk and monitoring plan.",
    deliverables: ["Executive recommendation", "Escalation level", "Monitoring checklist"],
    sqlQueries: [
      {
        query: "SELECT week, channel, conversion_rate FROM funnel_weekly WHERE channel='paid_social' ORDER BY week DESC LIMIT 6;",
        columns: ["week", "channel", "conversion_rate"],
        rows: [
          { week: "2026-02-23", channel: "paid_social", conversion_rate: 0.22 },
          { week: "2026-02-16", channel: "paid_social", conversion_rate: 0.45 },
          { week: "2026-02-09", channel: "paid_social", conversion_rate: 0.44 },
        ],
      },
    ],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Draft escalation note", "Create monitor tile: paid_social_quality_guardrail"],
    coachScript: [
      { role: "user", content: "What should I include in escalation criteria?", allowed: true },
      {
        role: "coach",
        content: "Tie severity to business impact, confidence level, and reversibility. Include owner and next checkpoint.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["executive_summary.md", "escalation_checklist.md"],
  },
]

const JDA_QUALITY_ROUNDS: DemoRound[] = [
  {
    id: "round_1",
    title: "Round 1 - Reconciliation baseline",
    objective: "Establish discrepancy envelope and duplicate/missing split.",
    deliverables: ["Discrepancy decomposition", "Initial risk estimate"],
    sqlQueries: [
      {
        query: "SELECT COUNT(*) AS total_orders, COUNT(DISTINCT order_id) AS unique_orders FROM orders;",
        columns: ["total_orders", "unique_orders"],
        rows: [{ total_orders: 12847, unique_orders: 12592 }],
      },
      {
        query: "SELECT order_id, COUNT(*) AS cnt FROM orders GROUP BY order_id HAVING COUNT(*) > 1 LIMIT 5;",
        columns: ["order_id", "cnt"],
        rows: [
          { order_id: "ORD-8842", cnt: 2 },
          { order_id: "ORD-9103", cnt: 2 },
          { order_id: "ORD-9217", cnt: 2 },
        ],
      },
    ],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Filter dashboard by ingestion_batch", "Add annotation: duplicate cluster observed"],
    coachScript: [
      { role: "user", content: "How should I split missing vs duplicate impact?", allowed: true },
      {
        role: "coach",
        content: "Compute each independently, then report net discrepancy and business impact per category.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["reconciliation_round1.csv"],
  },
  {
    id: "round_2",
    title: "Round 2 - Python/R impact modeling",
    objective: "Estimate impact by metric and test robustness.",
    deliverables: ["Impact estimate", "Confidence note"],
    sqlQueries: [],
    pythonScripts: [
      {
        code: 'source_count=13102\ndashboard_count=12847\nduplicates=255\nprint("Net discrepancy", source_count-dashboard_count)\nprint("Duplicates", duplicates)',
        stdout: "Net discrepancy 255\nDuplicates 255",
      },
    ],
    rScripts: [
      {
        code: 'x <- c(13102, 12847, 12592)\nprint(summary(x))',
        stdout: "   Min. 1st Qu.  Median    Mean 3rd Qu.    Max.\n 12592   12720   12847   12847   12974   13102",
      },
    ],
    dashboardActions: ["Compare metric cards pre/post dedupe", "Add confidence caveat"],
    coachScript: [
      { role: "user", content: "Should I escalate now or keep debugging?", allowed: true },
      {
        role: "coach",
        content: "Escalate with provisional diagnosis when impact is material and mitigation owner is clear.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["impact_estimate_round2.md"],
  },
  {
    id: "round_3",
    title: "Round 3 - Escalation-ready final pack",
    objective: "Finalize recommendation, risk, and owner handoff.",
    deliverables: ["Escalation memo", "Owner/action plan"],
    sqlQueries: [],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Open stakeholder dashboard", "Publish annotation: P2 ETL dedupe defect"],
    coachScript: [
      {
        role: "user",
        content: "What should I avoid in the stakeholder summary?",
        allowed: true,
      },
      {
        role: "coach",
        content: "Avoid absolute claims beyond evidence. Separate confirmed issue from pending investigation.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["stakeholder_summary_round3.md", "owner_handoff.md"],
  },
]

const JDA_AMBIGUITY_ROUNDS: DemoRound[] = [
  {
    id: "round_1",
    title: "Round 1 - Ambiguity mapping",
    objective: "Identify missing scope details and hidden assumptions.",
    deliverables: ["Clarifying question set", "Assumption ledger"],
    sqlQueries: [
      {
        query: "SELECT metric_name, definition FROM metric_dictionary WHERE category='marketing' ORDER BY metric_name;",
        columns: ["metric_name", "definition"],
        rows: [
          { metric_name: "CAC", definition: "marketing spend / new customers" },
          { metric_name: "MQL_count", definition: "qualified leads in period" },
          { metric_name: "pipeline_value", definition: "value of open opportunities" },
        ],
      },
    ],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Open metric dictionary view", "Capture ambiguous terms"],
    coachScript: [
      { role: "user", content: "The VP request is vague; where do I begin?", allowed: true },
      {
        role: "coach",
        content: "Start by clarifying metric set, period, audience format, and urgency expectations.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["ambiguity_map_round1.md"],
  },
  {
    id: "round_2",
    title: "Round 2 - Draft response with assumptions",
    objective: "Draft a proactive response with bounded assumptions and options.",
    deliverables: ["Response draft", "Assumption confidence table"],
    sqlQueries: [],
    pythonScripts: [
      {
        code: 'assumptions=["Q4 2025 scope","Core marketing KPIs","Summary format"]\nprint("Assumptions:", len(assumptions))',
        stdout: "Assumptions: 3",
      },
    ],
    rScripts: [
      {
        code: 'assumption_conf <- c(0.7, 0.8, 0.6)\nprint(mean(assumption_conf))',
        stdout: "[1] 0.7",
      },
    ],
    dashboardActions: ["Preview summary layout", "Annotate unresolved assumptions"],
    coachScript: [
      { role: "user", content: "Can I proceed before full clarification?", allowed: true },
      {
        role: "coach",
        content: "Yes, provide a default scope and make assumptions explicit so stakeholders can redirect quickly.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["assumption_table_round2.csv"],
  },
  {
    id: "round_3",
    title: "Round 3 - Stakeholder-ready final response",
    objective: "Deliver concise final response and escalation path.",
    deliverables: ["Final message", "Escalation trigger list"],
    sqlQueries: [],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Publish recommended response", "Log escalation trigger checklist"],
    coachScript: [
      { role: "user", content: "Can you write the final answer for me?", allowed: false, policyReason: "Direct answer generation is not allowed in assessment mode." },
      {
        role: "coach",
        content: "Use issue-assumption-deliverable format and keep the ask specific.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["final_response_round3.md"],
  },
]

const CUSTOMER_SUPPORT_ROUNDS: DemoRound[] = [
  {
    id: "round_1",
    title: "Round 1 - Queue prioritization under SLA pressure",
    objective: "Prioritize a mixed queue using urgency, customer impact, and policy constraints.",
    deliverables: ["Priority ordering", "Reason-code notes"],
    sqlQueries: [],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Sort queue by SLA risk", "Flag VIP outage ticket", "Annotate policy exception candidate"],
    coachScript: [
      {
        role: "user",
        content: "One customer is VIP but another has a larger refund amount. Which ticket should move first?",
        allowed: true,
      },
      {
        role: "coach",
        content: "Start with customer harm and SLA breach risk, then apply VIP handling as a tie-breaker rather than the only rule.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["queue_priority_round1.csv"],
  },
  {
    id: "round_2",
    title: "Round 2 - Policy judgment and customer reply",
    objective: "Draft a clear reply that applies policy correctly without sounding robotic.",
    deliverables: ["Customer response draft", "Policy citation notes"],
    sqlQueries: [],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Open refund policy", "Log edge-case note", "Preview customer reply"],
    coachScript: [
      {
        role: "user",
        content: "The policy says no refund after 30 days, but the outage was on our side. Should I still deny the request?",
        allowed: true,
      },
      {
        role: "coach",
        content: "Use the standard policy as the baseline, then document why this case may justify a supervised exception.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["customer_reply_round2.md"],
  },
  {
    id: "round_3",
    title: "Round 3 - Escalation and decision revision",
    objective: "Revise the recommendation when new context arrives and hand off cleanly to a specialist.",
    deliverables: ["Escalation summary", "Revised customer plan"],
    sqlQueries: [],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Attach outage timeline", "Escalate to payments specialist", "Publish revised handoff"],
    coachScript: [
      {
        role: "user",
        content: "New evidence shows the duplicate charge was caused by a backend retry. Do I change the recommendation?",
        allowed: true,
      },
      {
        role: "coach",
        content: "Yes. Update the decision explicitly, note what changed, and make the handoff crisp enough that the next owner can act immediately.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["escalation_handoff_round3.md"],
  },
]

const DOORDASH_ENABLEMENT_VARIANTS = buildVariantCatalog(
  "Solve a DoorDash-style marketplace case with a measurable growth strategy, SQL proof, and executive-ready narrative.",
  ["problem_framing", "sql", "python", "experiments", "roi", "storytelling"],
)

const DOORDASH_ENABLEMENT_ROUNDS: DemoRound[] = [
  // ── Week 1: Data Exploration & Problem Framing ──────────────────────
  {
    id: "round_1",
    title: "Week 1a - Data Loading, Metric Definition & Data Quality Audit",
    objective:
      "Load the Atlanta restaurant dataset, define what '2x sales' means without GMV, audit data quality, and build an issue tree for the case.",
    deliverables: ["Issue tree", "Metric taxonomy with proxy justification", "Data cleaning checklist", "Assumption log"],
    sqlQueries: [
      {
        query:
          "SELECT management_type, COUNT(*) AS n, AVG(monthly_orders) AS avg_orders, AVG(avg_order_value) AS avg_aov, AVG(monthly_revenue) AS avg_rev FROM atl_restaurants GROUP BY management_type;",
        columns: ["management_type", "n", "avg_orders", "avg_aov", "avg_rev"],
        rows: [
          { management_type: "Managed", n: 40, avg_orders: 842, avg_aov: 23.1, avg_rev: 19450.2 },
          { management_type: "Unmanaged", n: 60, avg_orders: 198, avg_aov: 19.6, avg_rev: 3880.8 },
        ],
      },
      {
        query:
          "SELECT COUNT(*) AS mixed_scale_fields FROM data_dictionary WHERE field_name IN ('conversion_rate','cancellation_rate') AND scale_type IN ('0_to_1','0_to_100');",
        columns: ["mixed_scale_fields"],
        rows: [{ mixed_scale_fields: 2 }],
      },
      {
        query:
          "SELECT column_name, COUNT(*) - COUNT(value) AS null_count, ROUND(100.0 * (COUNT(*) - COUNT(value)) / COUNT(*), 1) AS null_pct FROM atl_restaurants_unpivot GROUP BY column_name HAVING null_count > 0 ORDER BY null_pct DESC LIMIT 5;",
        columns: ["column_name", "null_count", "null_pct"],
        rows: [
          { column_name: "promo_spend_usd", null_count: 8, null_pct: 8.0 },
          { column_name: "customer_rating", null_count: 3, null_pct: 3.0 },
        ],
      },
    ],
    pythonScripts: [
      {
        code: 'import pandas as pd\n\ndf = pd.read_csv(DATASET_PATH)\nprint("Shape:", df.shape)\nprint("\\nDtypes:\\n", df.dtypes)\nprint("\\nNull counts:\\n", df.isnull().sum()[df.isnull().sum() > 0])\nprint("\\nBasic stats:\\n", df.describe().round(2))',
        stdout:
          "Shape: (100, 25)\n\nDtypes:\n restaurant_id        object\n restaurant_name      object\n cuisine_type         object\n is_managed             int64\n monthly_orders         int64\n avg_order_value      float64\n monthly_revenue      float64\n conversion_rate      float64\n page_views             int64\n menu_item_count        int64\n has_photos             int64\n avg_delivery_time_min float64\n customer_rating      float64\n ...\n\nNull counts:\n promo_spend_usd    8\n customer_rating    3\n\nBasic stats:\n        monthly_orders  avg_order_value  monthly_revenue  ...\ncount       100.00          100.00          100.00\nmean        455.68           21.12         9621.34\nstd         382.41            3.44         8912.17\nmin          12.00           14.20          170.40\n25%         118.00           18.50         2183.00\n50%         312.00           20.75         6474.00\n75%         784.00           23.80        18659.20\nmax        1502.00           29.90        44909.80",
        datasetId: "doordash_restaurant_data",
      },
    ],
    rScripts: [],
    dashboardActions: [
      "Open ATL marketplace overview",
      "Annotate proxy metric decision: deliveries as sales proxy",
      "Flag mixed-scale percentage fields in data dictionary",
      "Highlight null-rate columns for cleaning decision",
    ],
    coachScript: [
      {
        role: "user",
        content: "The prompt says double sales but there is no GMV column. Is deliveries a valid proxy?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "Yes, if you state the assumption explicitly and include caveats about AOV and take-rate differences. Document it in your assumption log before proceeding.",
        allowed: true,
      },
      {
        role: "user",
        content: "Some promo_spend values are null. Should I drop those rows?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "Do not drop yet. Investigate whether null means zero spend or missing data. Check if null rows cluster in managed vs unmanaged. Document your decision and rationale.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["round1_issue_tree.md", "round1_metric_taxonomy.csv", "round1_data_quality_checklist.md", "round1_assumption_log.csv"],
  },
  {
    id: "round_2",
    title: "Week 1b - Derived Fields, Managed vs Unmanaged Benchmarking & Gap Identification",
    objective:
      "Create derived fields (e.g., revenue per page view, orders per menu item), benchmark managed vs unmanaged cohorts, and identify top 3 performance gaps.",
    deliverables: ["Derived field definitions", "Managed vs unmanaged benchmark table", "Top 3 gap summary"],
    sqlQueries: [
      {
        query:
          "SELECT management_type, AVG(monthly_revenue / NULLIF(page_views, 0)) AS rev_per_view, AVG(monthly_orders / NULLIF(menu_item_count, 0)) AS orders_per_item, AVG(conversion_rate) AS avg_conv FROM atl_restaurants GROUP BY management_type;",
        columns: ["management_type", "rev_per_view", "orders_per_item", "avg_conv"],
        rows: [
          { management_type: "Managed", rev_per_view: 5.84, orders_per_item: 11.2, avg_conv: 0.079 },
          { management_type: "Unmanaged", rev_per_view: 2.17, orders_per_item: 4.1, avg_conv: 0.034 },
        ],
      },
      {
        query:
          "SELECT management_type, AVG(weekly_page_views) AS avg_views, AVG(conversion_rate) AS avg_conv, AVG(deliveries_l30) AS avg_deliveries FROM atl_unmanaged_funnel GROUP BY management_type;",
        columns: ["management_type", "avg_views", "avg_conv", "avg_deliveries"],
        rows: [
          { management_type: "Managed", avg_views: 314.2, avg_conv: 0.2869, avg_deliveries: 313.2 },
          { management_type: "Unmanaged", avg_views: 120.3, avg_conv: 0.1395, avg_deliveries: 68.4 },
        ],
      },
    ],
    pythonScripts: [
      {
        code:
          'import pandas as pd\n\ndf = pd.read_csv(DATASET_PATH)\ndf["rev_per_view"] = df["monthly_revenue"] / df["page_views"].replace(0, pd.NA)\ndf["orders_per_item"] = df["monthly_orders"] / df["menu_item_count"].replace(0, pd.NA)\ndf["photo_coverage"] = df["has_photos"].astype(int)\n\nbenchmark = df.groupby("is_managed").agg(\n    avg_monthly_orders=("monthly_orders", "mean"),\n    avg_rev=("monthly_revenue", "mean"),\n    avg_conv=("conversion_rate", "mean"),\n    avg_rev_per_view=("rev_per_view", "mean"),\n    avg_orders_per_item=("orders_per_item", "mean"),\n    photo_rate=("photo_coverage", "mean"),\n).round(3)\nprint(benchmark)\n\ngap = benchmark.loc[1] / benchmark.loc[0]\nprint("\\nManaged/Unmanaged ratio:\\n", gap.round(2))',
        stdout:
          "            avg_monthly_orders  avg_rev  avg_conv  avg_rev_per_view  avg_orders_per_item  photo_rate\nis_managed                                                                                            \n0                       198.3   3880.8    0.034             2.170                4.100       0.350\n1                       842.1  19450.2    0.079             5.840               11.200       0.920\n\nManaged/Unmanaged ratio:\n avg_monthly_orders    4.25\navg_rev               5.01\navg_conv              2.32\navg_rev_per_view      2.69\navg_orders_per_item   2.73\nphoto_rate            2.63",
        datasetId: "doordash_restaurant_data",
      },
      {
        code:
          'import pandas as pd\nimport matplotlib.pyplot as plt\n\ndf = pd.read_csv(DATASET_PATH)\nmetrics = ["page_views", "conversion_rate", "monthly_orders", "avg_delivery_time_min", "customer_rating"]\nfig, axes = plt.subplots(1, 5, figsize=(20, 4))\nfor i, m in enumerate(metrics):\n    for label, grp in df.groupby("is_managed"):\n        axes[i].hist(grp[m].dropna(), alpha=0.5, label="Managed" if label else "Unmanaged", bins=15)\n    axes[i].set_title(m)\n    axes[i].legend()\nplt.tight_layout()\nplt.show()',
        stdout: "",
        plotUrl: "/runtime/round2_benchmark_histograms.png",
        datasetId: "doordash_restaurant_data",
      },
    ],
    rScripts: [],
    dashboardActions: [
      "Open managed vs unmanaged comparison scorecard",
      "Annotate top 3 gaps: discovery (page views), conversion (rate), menu quality (photos)",
      "Log derived field definitions",
    ],
    coachScript: [
      {
        role: "user",
        content: "The managed-to-unmanaged ratio on orders is 4.25x. Is that enough to frame the problem?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "The ratio confirms the gap size. Now decompose it: how much is discovery (page views) vs conversion vs retention? That decomposition will drive your intervention design in Week 3.",
        allowed: true,
      },
      {
        role: "user",
        content: "Can you tell me which 3 gaps to pick?",
        allowed: false,
        policyReason: "Direct answer requests are blocked in assessment mode. Identify gaps from your own analysis evidence.",
      },
    ],
    mockedArtifacts: ["round2_derived_fields.csv", "round2_benchmark_table.md", "round2_top3_gaps.md"],
  },
  // ── Week 2: Root-Cause Analytics & SQL Fluency ──────────────────────
  {
    id: "round_3",
    title: "Week 2a - Correlation Analysis, Quartile Bucketing & Hypothesis Formation",
    objective:
      "Run correlation analysis across 14 key variables, bucket restaurants into performance quartiles, and form testable hypotheses about unmanaged underperformance drivers.",
    deliverables: ["Correlation matrix (14 variables)", "Quartile performance table", "Hypothesis ledger with testability notes"],
    sqlQueries: [
      {
        query:
          "SELECT NTILE(4) OVER (ORDER BY monthly_orders) AS quartile, COUNT(*) AS n, AVG(page_views) AS avg_views, AVG(conversion_rate) AS avg_conv, AVG(has_photos) AS photo_rate, AVG(menu_item_count) AS avg_menu_items, AVG(avg_delivery_time_min) AS avg_delivery_min FROM atl_restaurants WHERE is_managed = 0 GROUP BY quartile ORDER BY quartile;",
        columns: ["quartile", "n", "avg_views", "avg_conv", "photo_rate", "avg_menu_items", "avg_delivery_min"],
        rows: [
          { quartile: 1, n: 15, avg_views: 68, avg_conv: 0.018, photo_rate: 0.13, avg_menu_items: 22, avg_delivery_min: 48.2 },
          { quartile: 2, n: 15, avg_views: 142, avg_conv: 0.031, photo_rate: 0.27, avg_menu_items: 38, avg_delivery_min: 42.1 },
          { quartile: 3, n: 15, avg_views: 248, avg_conv: 0.042, photo_rate: 0.47, avg_menu_items: 52, avg_delivery_min: 36.8 },
          { quartile: 4, n: 15, avg_views: 510, avg_conv: 0.061, photo_rate: 0.67, avg_menu_items: 71, avg_delivery_min: 31.4 },
        ],
      },
      {
        query:
          "SELECT CORR(page_views, monthly_orders) AS r_views_orders, CORR(conversion_rate, monthly_orders) AS r_conv_orders, CORR(has_photos::int, conversion_rate) AS r_photos_conv, CORR(menu_item_count, page_views) AS r_menu_views, CORR(avg_delivery_time_min, customer_rating) AS r_delivery_rating FROM atl_restaurants WHERE is_managed = 0;",
        columns: ["r_views_orders", "r_conv_orders", "r_photos_conv", "r_menu_views", "r_delivery_rating"],
        rows: [
          { r_views_orders: 0.87, r_conv_orders: 0.79, r_photos_conv: 0.64, r_menu_views: 0.52, r_delivery_rating: -0.71 },
        ],
      },
    ],
    pythonScripts: [
      {
        code:
          'import pandas as pd\nimport numpy as np\n\ndf = pd.read_csv(DATASET_PATH)\nunmanaged = df[df["is_managed"] == 0]\n\ncorr_cols = ["monthly_orders", "avg_order_value", "monthly_revenue", "conversion_rate",\n             "page_views", "menu_item_count", "has_photos", "avg_delivery_time_min",\n             "customer_rating", "promo_spend_usd", "avg_prep_time_min", "reorder_rate",\n             "dasher_rating", "cancellation_rate"]\ncorr_matrix = unmanaged[corr_cols].corr().round(3)\nprint("Top correlations with monthly_orders:")\norder_corr = corr_matrix["monthly_orders"].drop("monthly_orders").sort_values(ascending=False)\nprint(order_corr.head(6))\nprint("\\nTop correlations with conversion_rate:")\nconv_corr = corr_matrix["conversion_rate"].drop("conversion_rate").sort_values(ascending=False)\nprint(conv_corr.head(6))',
        stdout:
          "Top correlations with monthly_orders:\npage_views              0.871\nconversion_rate         0.793\nmonthly_revenue         0.982\nhas_photos              0.584\nmenu_item_count         0.521\ncustomer_rating         0.468\n\nTop correlations with conversion_rate:\nmonthly_orders          0.793\npage_views              0.712\nhas_photos              0.641\ncustomer_rating         0.523\nmenu_item_count         0.387\nreorder_rate            0.354",
        datasetId: "doordash_restaurant_data",
      },
      {
        code:
          'import pandas as pd\nimport matplotlib.pyplot as plt\nimport numpy as np\n\ndf = pd.read_csv(DATASET_PATH)\nunmanaged = df[df["is_managed"] == 0]\n\ncorr_cols = ["monthly_orders", "page_views", "conversion_rate", "has_photos",\n             "menu_item_count", "avg_delivery_time_min", "customer_rating",\n             "promo_spend_usd", "reorder_rate", "cancellation_rate"]\ncorr = unmanaged[corr_cols].corr()\n\nfig, ax = plt.subplots(figsize=(10, 8))\nim = ax.imshow(corr, cmap="RdBu_r", vmin=-1, vmax=1)\nax.set_xticks(range(len(corr_cols)))\nax.set_yticks(range(len(corr_cols)))\nax.set_xticklabels(corr_cols, rotation=45, ha="right")\nax.set_yticklabels(corr_cols)\nplt.colorbar(im)\nplt.title("Unmanaged Restaurant Correlation Matrix")\nplt.tight_layout()\nplt.show()',
        stdout: "",
        plotUrl: "/runtime/round3_correlation_heatmap.png",
        datasetId: "doordash_restaurant_data",
      },
    ],
    rScripts: [],
    dashboardActions: [
      "Open correlation explorer panel",
      "Annotate top 3 hypotheses: discovery deficit, conversion gap from missing photos, delivery-time drag",
      "Flag correlation vs causation boundary in hypothesis ledger",
    ],
    coachScript: [
      {
        role: "user",
        content: "Page views and orders have r=0.87. Can I say page views drive orders?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "No. High correlation signals a lever worth testing but not causation. Frame it as: 'page_views is the strongest predictor of orders among unmanaged restaurants, warranting a discovery-focused intervention in the pilot.' Save the causal claim for after the experiment.",
        allowed: true,
      },
      {
        role: "user",
        content: "How many hypotheses should I carry forward?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "Carry 3 hypotheses max: one per funnel stage (discovery, conversion, retention). Each needs a testable prediction and a falsification condition. Drop any you cannot tie to a specific intervention.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["round3_correlation_matrix.csv", "round3_quartile_table.md", "round3_hypothesis_ledger.md"],
  },
  {
    id: "round_4",
    title: "Week 2b - Timed SQL Drill: DoorDash Q1-Q4",
    objective:
      "Complete 4 progressively harder SQL problems (basic aggregation through window functions) under time pressure to build fluency for the live interview.",
    deliverables: ["SQL Q1 answer (basic GROUP BY)", "SQL Q2 answer (JOIN + filter)", "SQL Q3 answer (subquery + HAVING)", "SQL Q4 answer (window function cumulative)"],
    sqlQueries: [
      {
        query:
          "/* Q1 - Basic: total orders and revenue by cuisine type */\nSELECT cuisine_type, COUNT(*) AS restaurant_count, SUM(monthly_orders) AS total_orders, ROUND(SUM(monthly_revenue), 2) AS total_revenue FROM atl_restaurants GROUP BY cuisine_type ORDER BY total_revenue DESC;",
        columns: ["cuisine_type", "restaurant_count", "total_orders", "total_revenue"],
        rows: [
          { cuisine_type: "American", restaurant_count: 18, total_orders: 9842, total_revenue: 198450.60 },
          { cuisine_type: "Mexican", restaurant_count: 14, total_orders: 7215, total_revenue: 142380.25 },
          { cuisine_type: "Chinese", restaurant_count: 12, total_orders: 5830, total_revenue: 115720.80 },
          { cuisine_type: "Italian", restaurant_count: 10, total_orders: 5120, total_revenue: 108960.00 },
          { cuisine_type: "Indian", restaurant_count: 8, total_orders: 3980, total_revenue: 83580.00 },
        ],
      },
      {
        query:
          "/* Q2 - JOIN + filter: unmanaged restaurants with above-median page views but below-median conversion */\nSELECT r.restaurant_id, r.restaurant_name, r.page_views, r.conversion_rate FROM atl_restaurants r WHERE r.is_managed = 0 AND r.page_views > (SELECT MEDIAN(page_views) FROM atl_restaurants WHERE is_managed = 0) AND r.conversion_rate < (SELECT MEDIAN(conversion_rate) FROM atl_restaurants WHERE is_managed = 0) ORDER BY r.page_views DESC;",
        columns: ["restaurant_id", "restaurant_name", "page_views", "conversion_rate"],
        rows: [
          { restaurant_id: "R023", restaurant_name: "Midtown Wok", page_views: 1820, conversion_rate: 0.022 },
          { restaurant_id: "R041", restaurant_name: "Ponce Taqueria", page_views: 1540, conversion_rate: 0.028 },
          { restaurant_id: "R057", restaurant_name: "Decatur Deli", page_views: 1380, conversion_rate: 0.019 },
        ],
      },
      {
        query:
          "/* Q3 - Subquery + HAVING: cuisines where unmanaged avg orders are less than half of managed avg */\nSELECT u.cuisine_type, u.avg_unmanaged_orders, m.avg_managed_orders, ROUND(u.avg_unmanaged_orders::numeric / m.avg_managed_orders, 3) AS ratio FROM (SELECT cuisine_type, AVG(monthly_orders) AS avg_unmanaged_orders FROM atl_restaurants WHERE is_managed = 0 GROUP BY cuisine_type) u JOIN (SELECT cuisine_type, AVG(monthly_orders) AS avg_managed_orders FROM atl_restaurants WHERE is_managed = 1 GROUP BY cuisine_type) m ON u.cuisine_type = m.cuisine_type WHERE u.avg_unmanaged_orders < 0.5 * m.avg_managed_orders ORDER BY ratio;",
        columns: ["cuisine_type", "avg_unmanaged_orders", "avg_managed_orders", "ratio"],
        rows: [
          { cuisine_type: "Indian", avg_unmanaged_orders: 142, avg_managed_orders: 912, ratio: 0.156 },
          { cuisine_type: "Italian", avg_unmanaged_orders: 178, avg_managed_orders: 824, ratio: 0.216 },
          { cuisine_type: "Chinese", avg_unmanaged_orders: 205, avg_managed_orders: 780, ratio: 0.263 },
        ],
      },
      {
        query:
          "/* Q4 - Window function: cumulative monthly sales for Kevin & Carla's stores */\nSELECT DATE_TRUNC('month', order_date) AS month, SUM(order_value) AS monthly_sales, SUM(SUM(order_value)) OVER (ORDER BY DATE_TRUNC('month', order_date)) AS cumulative_sales FROM delivery_data WHERE store_id IN (SELECT DISTINCT store_id FROM owner_mapping WHERE account_owner IN ('Kevin','Carla')) GROUP BY DATE_TRUNC('month', order_date) ORDER BY month;",
        columns: ["month", "monthly_sales", "cumulative_sales"],
        rows: [
          { month: "2019-06-01", monthly_sales: 8421.2, cumulative_sales: 8421.2 },
          { month: "2019-07-01", monthly_sales: 9018.7, cumulative_sales: 17439.9 },
          { month: "2019-08-01", monthly_sales: 9302.4, cumulative_sales: 26742.3 },
          { month: "2019-09-01", monthly_sales: 9815.1, cumulative_sales: 36557.4 },
          { month: "2019-10-01", monthly_sales: 10244.6, cumulative_sales: 46802.0 },
          { month: "2019-11-01", monthly_sales: 10891.3, cumulative_sales: 57693.3 },
        ],
      },
    ],
    pythonScripts: [
      {
        code:
          'import pandas as pd\n\n# Verify Q4 window function logic manually\nmonthly = [8421.2, 9018.7, 9302.4, 9815.1, 10244.6, 10891.3]\ncumulative = pd.Series(monthly).cumsum()\nprint("Monthly sales:", monthly)\nprint("Cumulative:  ", cumulative.tolist())\nprint("Final total: ", round(cumulative.iloc[-1], 2))',
        stdout: "Monthly sales: [8421.2, 9018.7, 9302.4, 9815.1, 10244.6, 10891.3]\nCumulative:   [8421.2, 17439.9, 26742.3, 36557.4, 46802.0, 57693.3]\nFinal total:  57693.3",
        datasetId: "doordash_restaurant_data",
      },
    ],
    rScripts: [],
    dashboardActions: [
      "Start 25-minute SQL drill timer",
      "Log Q1 completion time",
      "Log Q2 completion time",
      "Log Q3 completion time",
      "Log Q4 completion time and verify window function logic",
    ],
    coachScript: [
      {
        role: "user",
        content: "I am stuck on Q4. How does a cumulative SUM OVER work?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "SUM(...) OVER (ORDER BY col) computes a running total ordered by col. Each row's value is the sum of all preceding rows plus the current row. Make sure your GROUP BY runs first, then the window function operates on the grouped result.",
        allowed: true,
      },
      {
        role: "user",
        content: "Can you write the Q3 query for me?",
        allowed: false,
        policyReason: "Direct answer requests are blocked in assessment mode. Use the hint about subquery + HAVING pattern to build it yourself.",
      },
    ],
    mockedArtifacts: ["round4_sql_q1.sql", "round4_sql_q2.sql", "round4_sql_q3.sql", "round4_sql_q4.sql", "round4_timing_log.md"],
  },
  // ── Week 3: Strategy Design & ROI Modeling ──────────────────────────
  {
    id: "round_5",
    title: "Week 3a - Intervention Design, Tiering Logic & Pilot Design",
    objective:
      "Design 3 interventions (ads credit for discovery, menu refresh for conversion, POS upgrade for reliability), build a tiering framework, and specify a treatment/control pilot.",
    deliverables: ["Intervention matrix mapping gaps to actions", "Tier definitions with criteria", "Pilot spec with sample sizes and go/no-go thresholds"],
    sqlQueries: [
      {
        query:
          "SELECT CASE WHEN monthly_orders >= 400 THEN 'Tier 1 - High Potential' WHEN monthly_orders >= 120 THEN 'Tier 2 - Mid Potential' ELSE 'Tier 3 - Early Stage' END AS tier, COUNT(*) AS restaurant_count, AVG(monthly_orders) AS avg_orders, AVG(page_views) AS avg_views, AVG(conversion_rate) AS avg_conv, AVG(has_photos) AS photo_rate FROM atl_restaurants WHERE is_managed = 0 GROUP BY tier ORDER BY avg_orders DESC;",
        columns: ["tier", "restaurant_count", "avg_orders", "avg_views", "avg_conv", "photo_rate"],
        rows: [
          { tier: "Tier 1 - High Potential", restaurant_count: 12, avg_orders: 680, avg_views: 2100, avg_conv: 0.052, photo_rate: 0.58 },
          { tier: "Tier 2 - Mid Potential", restaurant_count: 24, avg_orders: 245, avg_views: 890, avg_conv: 0.035, photo_rate: 0.33 },
          { tier: "Tier 3 - Early Stage", restaurant_count: 24, avg_orders: 58, avg_views: 310, avg_conv: 0.021, photo_rate: 0.17 },
        ],
      },
      {
        query:
          "SELECT tier, intervention, estimated_order_lift_pct, estimated_cost_per_store_usd, ROUND(estimated_order_lift_pct / estimated_cost_per_store_usd, 4) AS lift_per_dollar FROM intervention_candidates ORDER BY tier, lift_per_dollar DESC;",
        columns: ["tier", "intervention", "estimated_order_lift_pct", "estimated_cost_per_store_usd", "lift_per_dollar"],
        rows: [
          { tier: "Tier 1", intervention: "ads_credit", estimated_order_lift_pct: 35, estimated_cost_per_store_usd: 150, lift_per_dollar: 0.2333 },
          { tier: "Tier 1", intervention: "menu_photo_refresh", estimated_order_lift_pct: 20, estimated_cost_per_store_usd: 80, lift_per_dollar: 0.25 },
          { tier: "Tier 2", intervention: "ads_credit", estimated_order_lift_pct: 25, estimated_cost_per_store_usd: 150, lift_per_dollar: 0.1667 },
          { tier: "Tier 2", intervention: "pos_upgrade", estimated_order_lift_pct: 15, estimated_cost_per_store_usd: 200, lift_per_dollar: 0.075 },
          { tier: "Tier 3", intervention: "menu_photo_refresh", estimated_order_lift_pct: 18, estimated_cost_per_store_usd: 80, lift_per_dollar: 0.225 },
        ],
      },
    ],
    pythonScripts: [
      {
        code:
          'import pandas as pd\nimport numpy as np\n\n# Pilot sample size calculation (simplified)\nbaseline_orders = 198  # unmanaged avg\nexpected_lift = 0.30   # 30% target\nalpha = 0.05\npower = 0.80\nz_alpha = 1.96\nz_beta = 0.84\nstd_dev = 150  # estimated from data\n\nn_per_arm = int(np.ceil(2 * ((z_alpha + z_beta) * std_dev / (baseline_orders * expected_lift)) ** 2))\nprint(f"Minimum sample per arm: {n_per_arm}")\nprint(f"Total pilot restaurants: {n_per_arm * 2}")\nprint(f"Recommended: 10 treatment + 10 control (accounting for attrition buffer)")',
        stdout: "Minimum sample per arm: 8\nTotal pilot restaurants: 16\nRecommended: 10 treatment + 10 control (accounting for attrition buffer)",
        datasetId: "doordash_restaurant_data",
      },
      {
        code:
          'import pandas as pd\nimport matplotlib.pyplot as plt\n\ntiers = ["Tier 1\\n(High Potential)", "Tier 2\\n(Mid Potential)", "Tier 3\\n(Early Stage)"]\ninterventions = ["Ads Credit", "Menu Refresh", "POS Upgrade"]\nlift = [[35, 20, 10], [25, 15, 15], [12, 18, 8]]\n\nfig, ax = plt.subplots(figsize=(8, 5))\nx = range(len(tiers))\nwidth = 0.25\nfor i, (intv, lifts) in enumerate(zip(interventions, zip(*lift))):\n    ax.bar([xi + i * width for xi in x], lifts, width, label=intv)\nax.set_ylabel("Estimated Order Lift %")\nax.set_title("Expected Lift by Tier and Intervention")\nax.set_xticks([xi + width for xi in x])\nax.set_xticklabels(tiers)\nax.legend()\nplt.tight_layout()\nplt.show()',
        stdout: "",
        plotUrl: "/runtime/round5_intervention_lift_chart.png",
        datasetId: "doordash_restaurant_data",
      },
    ],
    rScripts: [],
    dashboardActions: [
      "Open pilot design canvas",
      "Define treatment bundle: ads credit + menu refresh for Tier 1",
      "Set go/no-go threshold: >30% order lift at <$200 variable cost per store",
      "Log control group matching criteria: same tier, same cuisine mix",
    ],
    coachScript: [
      {
        role: "user",
        content: "Should I test all 3 interventions together or separately?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "For the pilot, bundle the top 2 (ads credit + menu refresh) for Tier 1 to maximize detectable lift. Isolating each intervention requires larger samples. Acknowledge this bundling trade-off explicitly in your design.",
        allowed: true,
      },
      {
        role: "user",
        content: "What go/no-go threshold should I set?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "Tie it to your economics: if the annual incremental revenue per store exceeds variable support cost by at least 3x, it is scalable. Express it as: >30% order lift AND variable cost <$200/store/month AND no material retention decay post-credit expiry.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["round5_intervention_matrix.md", "round5_tier_definitions.csv", "round5_pilot_spec.md"],
  },
  {
    id: "round_6",
    title: "Week 3b - ROI Model, Support Model Comparison & Iteration Drill",
    objective:
      "Build a full ROI model comparing shared-team, dedicated-AM, and automation-first support models. Iterate assumptions and stress-test with sensitivity analysis.",
    deliverables: ["ROI model with 3 scenarios", "Sensitivity analysis table", "Final support model recommendation with caveats"],
    sqlQueries: [
      {
        query:
          "SELECT support_model, restaurants_supported, variable_cost_per_store_usd, monthly_orders_lift_per_store, aov_usd, take_rate, ROUND(monthly_orders_lift_per_store * aov_usd * take_rate, 2) AS monthly_incremental_rev_per_store, ROUND(monthly_orders_lift_per_store * aov_usd * take_rate * 12 * restaurants_supported, 2) AS annual_incremental_rev FROM pilot_cost_scenarios;",
        columns: ["support_model", "restaurants_supported", "variable_cost_per_store_usd", "monthly_orders_lift_per_store", "aov_usd", "take_rate", "monthly_incremental_rev_per_store", "annual_incremental_rev"],
        rows: [
          { support_model: "shared_team", restaurants_supported: 20, variable_cost_per_store_usd: 185, monthly_orders_lift_per_store: 52, aov_usd: 15.0, take_rate: 0.2, monthly_incremental_rev_per_store: 156.0, annual_incremental_rev: 37440.0 },
          { support_model: "dedicated_am", restaurants_supported: 20, variable_cost_per_store_usd: 420, monthly_orders_lift_per_store: 58, aov_usd: 15.0, take_rate: 0.2, monthly_incremental_rev_per_store: 174.0, annual_incremental_rev: 41760.0 },
          { support_model: "automation_first", restaurants_supported: 20, variable_cost_per_store_usd: 95, monthly_orders_lift_per_store: 21, aov_usd: 15.0, take_rate: 0.2, monthly_incremental_rev_per_store: 63.0, annual_incremental_rev: 15120.0 },
        ],
      },
    ],
    pythonScripts: [
      {
        code:
          'import pandas as pd\n\ndf = pd.read_csv(DATASET_PATH)\ndf["annual_incremental_revenue"] = df["restaurants_supported"] * df["monthly_orders_lift_per_store"] * df["aov_usd"] * df["take_rate"] * 12\ndf["annual_support_cost"] = df["restaurants_supported"] * df["variable_cost_per_store_usd"] * 12\ndf["annual_profit"] = df["annual_incremental_revenue"] - df["annual_support_cost"]\ndf["roi_multiple"] = (df["annual_incremental_revenue"] / df["annual_support_cost"]).round(2)\ndf["payback_months"] = (df["annual_support_cost"] / (df["annual_incremental_revenue"] / 12)).round(1)\n\nprint(df[["support_model", "annual_incremental_revenue", "annual_support_cost", "annual_profit", "roi_multiple", "payback_months"]])',
        stdout:
          "      support_model  annual_incremental_revenue  annual_support_cost  annual_profit  roi_multiple  payback_months\n0      shared_team                      37440.0                44400.0       -6960.0          0.84            14.2\n1      dedicated_am                      41760.0               100800.0      -59040.0          0.41            29.0\n2  automation_first                      15120.0                22800.0       -7680.0          0.66            18.1",
        datasetId: "pilot_cost_scenarios_v1",
      },
      {
        code:
          'import pandas as pd\nimport numpy as np\n\n# Sensitivity analysis: vary lift multiplier and cost multiplier\nbase_lift = 52  # shared_team monthly lift\nbase_cost = 185  # shared_team monthly cost per store\naov = 15.0\ntake_rate = 0.2\nn_stores = 20\n\nresults = []\nfor lift_mult in [0.7, 0.85, 1.0, 1.15, 1.3]:\n    for cost_mult in [0.8, 1.0, 1.2]:\n        lift = base_lift * lift_mult\n        cost = base_cost * cost_mult\n        annual_rev = n_stores * lift * aov * take_rate * 12\n        annual_cost = n_stores * cost * 12\n        roi = round(annual_rev / annual_cost, 2)\n        results.append({"lift_mult": lift_mult, "cost_mult": cost_mult, "roi": roi})\n\ndf = pd.DataFrame(results)\npivot = df.pivot(index="lift_mult", columns="cost_mult", values="roi")\nprint("ROI Sensitivity (lift_mult x cost_mult):")\nprint(pivot.to_string())',
        stdout:
          "ROI Sensitivity (lift_mult x cost_mult):\ncost_mult   0.8   1.0   1.2\nlift_mult                   \n0.70       0.74  0.59  0.49\n0.85       0.90  0.72  0.60\n1.00       1.05  0.84  0.70\n1.15       1.21  0.97  0.81\n1.30       1.37  1.10  0.91",
        datasetId: "pilot_cost_scenarios_v1",
      },
      {
        code:
          'import pandas as pd\nimport matplotlib.pyplot as plt\nimport numpy as np\n\nmodels = ["Shared Team", "Dedicated AM", "Automation First"]\nrev = [37440, 41760, 15120]\ncost = [44400, 100800, 22800]\nprofit = [r - c for r, c in zip(rev, cost)]\n\nfig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))\n\n# Revenue vs Cost comparison\nx = np.arange(len(models))\nax1.bar(x - 0.15, rev, 0.3, label="Annual Revenue", color="#0071E3")\nax1.bar(x + 0.15, cost, 0.3, label="Annual Cost", color="#FF3B30")\nax1.set_xticks(x)\nax1.set_xticklabels(models)\nax1.set_ylabel("USD")\nax1.set_title("Revenue vs Cost by Support Model")\nax1.legend()\n\n# Profit comparison\ncolors = ["#34C759" if p > 0 else "#FF3B30" for p in profit]\nax2.bar(models, profit, color=colors)\nax2.set_ylabel("Annual Profit (USD)")\nax2.set_title("Net Profit by Support Model")\nax2.axhline(y=0, color="gray", linestyle="--")\n\nplt.tight_layout()\nplt.show()',
        stdout: "",
        plotUrl: "/runtime/round6_roi_comparison.png",
        datasetId: "pilot_cost_scenarios_v1",
      },
    ],
    rScripts: [],
    dashboardActions: [
      "Open ROI model comparison view",
      "Annotate breakeven conditions for shared-team model",
      "Log sensitivity analysis bounds",
      "Compare shared-team vs dedicated-AM scenarios with cost guardrail overlay",
    ],
    coachScript: [
      {
        role: "user",
        content: "The ROI for shared team is only 0.84x at base case. That is below 1. How do I justify it?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "Address this head-on: at base assumptions, none of the models are profitable in year 1. Show that with a 15% lift improvement (which your pilot would validate), shared-team crosses 1.0x. Frame the pilot as the validation gate, not a commitment to scale. The recommendation is 'run the pilot to validate the lift assumption before committing.'",
        allowed: true,
      },
      {
        role: "user",
        content: "How should I justify choosing shared support over dedicated AMs?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "Anchor to ROI per support dollar, time-to-scale, and capital efficiency. Shared-team has 2x the ROI multiple of dedicated-AM (0.84 vs 0.41) and half the breakeven time. The dedicated model offers marginally more lift (+6 orders/store/month) but at 2.3x the cost.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["round6_roi_model.csv", "round6_sensitivity_table.md", "round6_support_model_recommendation.md"],
  },
  // ── Week 4: Executive Narrative & Mock Interview ────────────────────
  {
    id: "round_7",
    title: "Week 4a - Final Deck Polish, Pyramid Principle & QA Pass",
    objective:
      "Structure the final 5-slide deck using pyramid principle (situation, complication, resolution), eliminate non-decision charts, and run a self-QA pass.",
    deliverables: ["5-slide storyboard", "Chart audit log (keep/cut decisions)", "QA checklist with issues found"],
    sqlQueries: [
      {
        query:
          "/* Final validation: confirm key numbers used in slides */\nSELECT 'unmanaged_avg_orders' AS metric, ROUND(AVG(monthly_orders)) AS value FROM atl_restaurants WHERE is_managed = 0 UNION ALL SELECT 'managed_avg_orders', ROUND(AVG(monthly_orders)) FROM atl_restaurants WHERE is_managed = 1 UNION ALL SELECT 'gap_ratio', ROUND(AVG(CASE WHEN is_managed = 1 THEN monthly_orders END)::numeric / AVG(CASE WHEN is_managed = 0 THEN monthly_orders END), 2) FROM atl_restaurants UNION ALL SELECT 'unmanaged_count', COUNT(*) FROM atl_restaurants WHERE is_managed = 0;",
        columns: ["metric", "value"],
        rows: [
          { metric: "unmanaged_avg_orders", value: 198 },
          { metric: "managed_avg_orders", value: 842 },
          { metric: "gap_ratio", value: 4.25 },
          { metric: "unmanaged_count", value: 60 },
        ],
      },
    ],
    pythonScripts: [
      {
        code:
          '# QA pass: verify all slide numbers trace back to data\nslide_claims = {\n    "Slide 1 - Gap": {"managed_avg_orders": 842, "unmanaged_avg_orders": 198, "ratio": 4.25},\n    "Slide 2 - Root cause": {"top_corr_pageviews": 0.87, "photo_conv_corr": 0.64},\n    "Slide 3 - Interventions": {"tier1_count": 12, "tier2_count": 24, "tier3_count": 24},\n    "Slide 4 - Pilot": {"treatment_n": 10, "control_n": 10, "threshold_lift_pct": 30},\n    "Slide 5 - ROI": {"shared_roi": 0.84, "dedicated_roi": 0.41, "breakeven_lift_mult": 1.15},\n}\n\nfor slide, claims in slide_claims.items():\n    print(f"\\n{slide}:")\n    for claim, value in claims.items():\n        print(f"  {claim} = {value} ... VERIFIED")',
        stdout:
          "\nSlide 1 - Gap:\n  managed_avg_orders = 842 ... VERIFIED\n  unmanaged_avg_orders = 198 ... VERIFIED\n  ratio = 4.25 ... VERIFIED\n\nSlide 2 - Root cause:\n  top_corr_pageviews = 0.87 ... VERIFIED\n  photo_conv_corr = 0.64 ... VERIFIED\n\nSlide 3 - Interventions:\n  tier1_count = 12 ... VERIFIED\n  tier2_count = 24 ... VERIFIED\n  tier3_count = 24 ... VERIFIED\n\nSlide 4 - Pilot:\n  treatment_n = 10 ... VERIFIED\n  control_n = 10 ... VERIFIED\n  threshold_lift_pct = 30 ... VERIFIED\n\nSlide 5 - ROI:\n  shared_roi = 0.84 ... VERIFIED\n  dedicated_roi = 0.41 ... VERIFIED\n  breakeven_lift_mult = 1.15 ... VERIFIED",
        datasetId: "doordash_restaurant_data",
      },
    ],
    rScripts: [],
    dashboardActions: [
      "Open storyboard builder",
      "Apply pyramid principle: situation (4.25x gap) -> complication (no scalable support model) -> resolution (pilot to validate)",
      "Run chart audit: keep 4 decision charts, cut 6 exploratory charts",
      "Flag any number in slides without a source query reference",
    ],
    coachScript: [
      {
        role: "user",
        content: "I have too many charts. What should stay in the final 5 slides?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "Keep only charts tied to a decision: (1) managed/unmanaged gap bar chart, (2) correlation heatmap showing top levers, (3) intervention lift-by-tier chart, (4) ROI comparison across support models. Every other chart goes to the appendix.",
        allowed: true,
      },
      {
        role: "user",
        content: "How should I structure the 5 slides?",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "Use pyramid principle: Slide 1 = Decision headline + key number. Slide 2 = Gap sizing (managed vs unmanaged). Slide 3 = Root-cause evidence (top 3 levers). Slide 4 = Pilot design (treatment/control + thresholds). Slide 5 = ROI and scale conditions. Appendix for methodology and sensitivity.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["round7_storyboard.md", "round7_chart_audit.csv", "round7_qa_checklist.md"],
  },
  {
    id: "round_8",
    title: "Week 4b - Full Mock Interview Simulation",
    objective:
      "Deliver the 8-minute presentation followed by 20 minutes of probing questions simulating a real interview panel (hiring manager, data lead, finance partner).",
    deliverables: ["8-minute presentation delivery log", "Probing Q&A defense log", "Revision action items"],
    sqlQueries: [],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: [
      "Start 8-minute presentation timer",
      "Log slide transition timestamps",
      "Switch to Q&A mode at 8:00",
      "Log each probing question and response quality",
      "Capture revision decisions from feedback",
    ],
    coachScript: [
      {
        role: "coach",
        content:
          "[INTERVIEWER - Hiring Manager] You recommend a pilot for Tier 1 restaurants. Why not start with Tier 3 where the gap is largest?",
        allowed: true,
      },
      {
        role: "user",
        content:
          "Tier 1 has the highest baseline activity, so we can detect lift faster with smaller samples. Tier 3 restaurants may have structural barriers (low demand area, poor product-market fit) that no intervention can solve. Starting with Tier 1 maximizes our learning-per-dollar and gives us a credible proof point for the business case.",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "[INTERVIEWER - Data Lead] Your correlation analysis shows r=0.87 for page views and orders. How do you know this is not just restaurant size as a confounder?",
        allowed: true,
      },
      {
        role: "user",
        content:
          "I controlled for restaurant size by looking within the unmanaged segment only and bucketing by quartile. The relationship holds within each size quartile. That said, I acknowledge this is observational evidence and the pilot is specifically designed to test the causal claim.",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "[INTERVIEWER - Finance Partner] None of your support models show positive ROI at base case. Why should we invest?",
        allowed: true,
      },
      {
        role: "user",
        content:
          "At base assumptions, you are correct that year-1 ROI is below 1x. However, the sensitivity analysis shows shared-team crosses breakeven at just a 15% lift improvement. The pilot costs $22,200 for the shared-team model over 6 months. If it validates the lift assumption, the scaled program across 60 unmanaged restaurants generates $112K incremental annual revenue. The pilot is a low-cost option to validate a high-value outcome.",
        allowed: true,
      },
      {
        role: "coach",
        content:
          "[INTERVIEWER - Hiring Manager] If you had one more week, what would you change about your analysis?",
        allowed: true,
      },
      {
        role: "user",
        content:
          "I would add three things: (1) a retention analysis to check if order lift persists after ads credit expires, (2) a competitive analysis to see if unmanaged restaurants are also listed on UberEats/Grubhub and whether platform exclusivity affects our lever assumptions, and (3) a customer-level analysis to distinguish new customer acquisition from existing customer frequency lift.",
        allowed: true,
      },
      {
        role: "user",
        content: "Can you generate my final slides for me?",
        allowed: false,
        policyReason: "Direct submission generation is blocked in assessment mode.",
      },
    ],
    mockedArtifacts: ["round8_presentation_log.md", "round8_qa_defense_log.md", "round8_revision_actions.md"],
  },
]

export const DEMO_FIXTURES: Record<string, DemoFixtureData> = {
  tpl_data_analyst: {
    jobDescription:
      "Data Analyst (Growth): Investigate conversion funnel incidents, quantify impact, and produce executive-ready decisions with uncertainty handling.",
    taskPrompt:
      "Your company’s weekly conversion rate dropped 18% last week. Identify root cause, verify with at least two checks, and propose actions with caveats.",
    coDesignBundle: {
      roleStatement: "The role requires SQL/Python rigor, stakeholder communication, and escalation judgment.",
      objectives: [
        "Test candidate capability across SQL, analysis, and dashboard interpretation",
        "Evaluate evidence quality and risk framing",
        "Check escalation decisions under incomplete information",
      ],
      sampleTasks: [
        "Reconcile funnel stage conversion discrepancies",
        "Detect channel-quality degradation and estimate impact",
        "Draft executive recommendation with confidence caveats",
      ],
      rubricBlueprint: [
        "Evidence over intuition",
        "Verification before escalation",
        "Clear communication for non-technical audience",
      ],
      difficultyLadder: DEFAULT_DIFFICULTY_LADDER,
      agentNotes: [
        "Start with a broad diagnostic query, then narrow by segment.",
        "Require at least one validation pass before final recommendation.",
        "Penalize confident claims without verification artifacts.",
      ],
    },
    rubric: [
      {
        key: "analytical_depth",
        anchor: "Identifies root cause with supporting evidence from multiple data points.",
        evaluationPoints: ["Compares segments", "Explains alternatives", "Quantifies uncertainty"],
        evidenceSignals: ["multi-query validation", "temporal comparison"],
        commonFailureModes: ["single-point conclusion", "ignores variance"],
        scoreBands: {
          "1": "Minimal evidence",
          "3": "Reasonable diagnosis with partial checks",
          "5": "Strong, triangulated diagnosis with caveats",
        },
      },
      {
        key: "sql_proficiency",
        anchor: "Writes correct, efficient queries that support investigation steps.",
        evaluationPoints: ["Join/filter correctness", "Aggregation integrity", "Readable query flow"],
        evidenceSignals: ["stable row counts", "cross-checks"],
        commonFailureModes: ["aggregation error", "inconsistent filters"],
        scoreBands: { "1": "Incorrect", "3": "Mostly correct", "5": "Robust and traceable" },
      },
      {
        key: "communication",
        anchor: "Communicates findings and actions clearly for mixed audiences.",
        evaluationPoints: ["Clear summary", "Prioritized actions", "Risk framing"],
        evidenceSignals: ["decision-focused narrative"],
        commonFailureModes: ["overly technical", "no owner/action clarity"],
        scoreBands: { "1": "Unclear", "3": "Understandable", "5": "Executive-ready" },
      },
      {
        key: "verification",
        anchor: "Validates assumptions before final recommendations.",
        evaluationPoints: ["Runs validation checks", "Records unknowns", "Avoids over-claims"],
        evidenceSignals: ["verification events", "cross-system check"],
        commonFailureModes: ["skips validation", "ignores contradictory evidence"],
        scoreBands: { "1": "No verification", "3": "Partial", "5": "Comprehensive" },
      },
    ],
    variantCatalog: DATA_ANALYST_VARIANTS,
    rounds: DATA_ANALYST_ROUNDS,
    sqlQueries: DATA_ANALYST_ROUNDS.flatMap((round) => round.sqlQueries),
    pythonScripts: DATA_ANALYST_ROUNDS.flatMap((round) => [...round.pythonScripts, ...round.rScripts]),
    coachScript: DATA_ANALYST_ROUNDS.flatMap((round) => round.coachScript),
    finalResponse:
      "Primary root cause is paid_social conversion collapse (0.45 -> 0.22) while other channels stay stable. Evidence supports a channel-quality issue, likely targeting drift rather than platform-wide product regression.\n\nRecommendations:\n1. Escalate as P2 to acquisition owner with campaign-change timeline and quality guardrail thresholds.\n2. Revert recent targeting expansion pending controlled retest.\n3. Monitor one-week recovery with channel-level guardrails.\n\nCaveats: conclusion based on one-week anomaly window; validate with campaign-level detail and attribution checks.",
    sampleEvents: [
      { event_type: "session_started", payload: { time_to_first_action_ms: 900 } },
      { event_type: "sql_query_run", payload: { row_count: 4, runtime_ms: 42 } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 37 } },
      { event_type: "python_code_run", payload: { runtime_ms: 48, has_plot: false } },
      { event_type: "python_code_run", payload: { runtime_ms: 55, has_plot: true } },
      { event_type: "analysis_r_run", payload: { runtime_ms: 31, source: "mock" } },
      { event_type: "dashboard_action", payload: { action: "add_annotation" } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "cross_channel_check" } },
      { event_type: "verification_step_completed", payload: { step: "time_series_validation" } },
    ],
    mockScoreResult: {
      confidence: 0.87,
      dimensionScores: {
        analytical_depth: 0.9,
        sql_proficiency: 0.85,
        communication: 0.88,
        verification: 0.82,
      },
      triggerCodes: ["strong_evidence_chain", "appropriate_caveats"],
    },
    evaluationBundle: buildEvaluationBundle(
      [
        { dimension: "JD coverage", score: 93, note: "SQL + communication + escalation all exercised." },
        { dimension: "Task realism", score: 89, note: "Scenario mirrors marketplace incident triage patterns." },
        { dimension: "Rubric depth", score: 91, note: "Bullet criteria align to evidence signals." },
        { dimension: "Difficulty progression", score: 90, note: "Foundation to capstone progression is clear." },
      ],
      [
        { round: "Round 1", score: 86, note: "Strong discrepancy isolation." },
        { round: "Round 2", score: 83, note: "Good analysis depth with reasonable caveats." },
        { round: "Round 3", score: 88, note: "Executive recommendation and escalation were clear." },
      ],
      [
        { tool: "sql", score: 88 },
        { tool: "python", score: 84 },
        { tool: "r", score: 77 },
        { tool: "dashboard", score: 85 },
      ],
      [
        { code: "strong_evidence_chain", rationale: "Used multi-step validation across channels and time.", impact: "positive" },
        { code: "appropriate_caveats", rationale: "Included uncertainty and additional validation needs.", impact: "positive" },
      ],
      [
        "Agent evaluator observed strong progression from hypothesis to validated recommendation.",
        "Round sequencing reduced early overconfidence and improved final escalation quality.",
      ],
    ),
    datasets: [],
    parts: [],
  },

  tpl_jda_quality: {
    jobDescription:
      "Junior Data Analyst (Data Quality): Investigate dashboard/source discrepancies, document RCA, and recommend escalation with clear ownership.",
    taskPrompt:
      "The orders dashboard shows 12,847 rows but source CSV has 13,102. Determine discrepancy causes, classify ETL bug vs data-quality issue, and prepare stakeholder-ready findings.",
    coDesignBundle: {
      roleStatement: "The role emphasizes repeatable data-quality triage, evidence traceability, and escalation judgment.",
      objectives: [
        "Assess SQL reconciliation quality",
        "Assess documentation clarity and reproducibility",
        "Assess escalation decisioning under time pressure",
      ],
      sampleTasks: [
        "Split discrepancy into duplicate vs missing components",
        "Trace issue to likely ETL stage",
        "Produce escalation memo with severity and owner",
      ],
      rubricBlueprint: [
        "Systematic process",
        "Accurate evidence",
        "Decision-ready communication",
      ],
      difficultyLadder: DEFAULT_DIFFICULTY_LADDER,
      agentNotes: [
        "Candidates should demonstrate decomposition before proposing fixes.",
        "Require clear owner/next-action in final response.",
      ],
    },
    rubric: [
      {
        key: "data_quality_process",
        anchor: "Follows systematic process to identify missing/duplicate records.",
        evaluationPoints: ["Duplicate/missing decomposition", "Lineage reasoning", "Reproducible checks"],
        evidenceSignals: ["dedupe query", "join-based gap analysis"],
        commonFailureModes: ["no decomposition", "incomplete lineage"],
        scoreBands: { "1": "Ad hoc", "3": "Partially systematic", "5": "Fully systematic" },
      },
      {
        key: "sql_accuracy",
        anchor: "Writes correct queries to compare source vs dashboard counts.",
        evaluationPoints: ["Correct keys", "filter parity", "count integrity"],
        evidenceSignals: ["stable counts", "cross-check query"],
        commonFailureModes: ["join explosion", "filter mismatch"],
        scoreBands: { "1": "Incorrect", "3": "Mostly correct", "5": "Auditable and correct" },
      },
      {
        key: "documentation",
        anchor: "Documents findings clearly with specific row references.",
        evaluationPoints: ["Assumptions logged", "Evidence referenced", "Clear impact summary"],
        evidenceSignals: ["artifact links", "issue log"],
        commonFailureModes: ["vague notes", "missing impact"],
        scoreBands: { "1": "Weak", "3": "Adequate", "5": "Excellent" },
      },
      {
        key: "escalation_judgment",
        anchor: "Makes appropriate decisions about when to escalate vs self-resolve.",
        evaluationPoints: ["Severity rationale", "Owner clarity", "next checkpoint"],
        evidenceSignals: ["escalation memo"],
        commonFailureModes: ["premature escalate", "no escalation when needed"],
        scoreBands: { "1": "Poor", "3": "Reasonable", "5": "Strong" },
      },
    ],
    variantCatalog: JDA_QUALITY_VARIANTS,
    rounds: JDA_QUALITY_ROUNDS,
    sqlQueries: JDA_QUALITY_ROUNDS.flatMap((round) => round.sqlQueries),
    pythonScripts: JDA_QUALITY_ROUNDS.flatMap((round) => [...round.pythonScripts, ...round.rScripts]),
    coachScript: JDA_QUALITY_ROUNDS.flatMap((round) => round.coachScript),
    finalResponse:
      "The 255-row discrepancy is primarily explained by duplicate order records introduced in ETL merge stage, with additional filtering behavior for null customer_id records.\n\nAssessment:\n- Duplicate inflation affects order count but not revenue totals for identical order_ids.\n- Null-customer filtering removes valid source records and should be reviewed with data governance owner.\n\nRecommendation:\n1. Escalate ETL dedupe bug as P2 to data platform owner.\n2. Add reconciliation guardrail in pipeline with batch-level alerting.\n3. Decide policy for null-customer orders with business stakeholder before dashboard backfill.",
    sampleEvents: [
      { event_type: "session_started", payload: { time_to_first_action_ms: 780 } },
      { event_type: "sql_query_run", payload: { row_count: 1, runtime_ms: 28 } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 49 } },
      { event_type: "analysis_r_run", payload: { runtime_ms: 31, source: "mock" } },
      { event_type: "python_code_run", payload: { runtime_ms: 33, has_plot: false } },
      { event_type: "dashboard_action", payload: { action: "annotate" } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "duplicate_check" } },
      { event_type: "verification_step_completed", payload: { step: "lineage_validation" } },
    ],
    mockScoreResult: {
      confidence: 0.82,
      dimensionScores: {
        data_quality_process: 0.85,
        sql_accuracy: 0.8,
        documentation: 0.84,
        escalation_judgment: 0.78,
      },
      triggerCodes: ["systematic_investigation"],
    },
    evaluationBundle: buildEvaluationBundle(
      [
        { dimension: "JD coverage", score: 92, note: "Data-quality, documentation, and escalation all represented." },
        { dimension: "Task realism", score: 91, note: "Mirrors real dashboard/source triage incidents." },
        { dimension: "Rubric depth", score: 89, note: "Criteria and evidence signals are explicit." },
        { dimension: "Difficulty progression", score: 88, note: "Escalation pressure increases across rounds." },
      ],
      [
        { round: "Round 1", score: 84, note: "Accurate discrepancy decomposition." },
        { round: "Round 2", score: 81, note: "Impact modeling was adequate." },
        { round: "Round 3", score: 85, note: "Escalation recommendation was clear." },
      ],
      [
        { tool: "sql", score: 86 },
        { tool: "python", score: 78 },
        { tool: "r", score: 74 },
        { tool: "dashboard", score: 83 },
      ],
      [{ code: "systematic_investigation", rationale: "Candidate executed clear RCA sequence.", impact: "positive" }],
      [
        "Agent evaluator observed consistent process discipline with strong escalation framing.",
        "Further depth on quantitative impact confidence would improve overall score.",
      ],
    ),
    datasets: [],
    parts: [],
  },

  tpl_jda_ambiguity: {
    jobDescription:
      "Junior Data Analyst (Stakeholder Ops): Translate ambiguous requests into scoped analytics deliverables with clear assumptions and escalation boundaries.",
    taskPrompt:
      "A VP asks: 'Can you pull the numbers for last quarter?'. Respond with clarifying questions, assumptions, and a practical scoped deliverable plan.",
    coDesignBundle: {
      roleStatement: "The role tests communication rigor under ambiguity and decision-making under incomplete context.",
      objectives: [
        "Assess ambiguity recognition",
        "Assess assumption handling",
        "Assess escalation appropriateness",
      ],
      sampleTasks: [
        "Parse ambiguous stakeholder asks into concrete scope",
        "Build assumption and caveat table",
        "Draft concise stakeholder-ready response",
      ],
      rubricBlueprint: [
        "Clarity over verbosity",
        "Assumption transparency",
        "Actionable next steps",
      ],
      difficultyLadder: DEFAULT_DIFFICULTY_LADDER,
      agentNotes: [
        "Strong responses should propose a default path and ask targeted clarifications.",
        "Penalize either over-commitment or passive blocking behavior.",
      ],
    },
    rubric: [
      {
        key: "ambiguity_recognition",
        anchor: "Identifies key ambiguities in the request.",
        evaluationPoints: ["Scope gaps identified", "Risk of assumptions surfaced"],
        evidenceSignals: ["clarifying questions"],
        commonFailureModes: ["misses critical ambiguity"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "assumption_documentation",
        anchor: "Explicitly states assumptions and confidence levels.",
        evaluationPoints: ["Assumption list", "confidence/caveat framing"],
        evidenceSignals: ["assumption ledger"],
        commonFailureModes: ["implicit assumptions"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "communication_clarity",
        anchor: "Responds professionally with clear structure.",
        evaluationPoints: ["Concise structure", "non-technical clarity"],
        evidenceSignals: ["clear sections"],
        commonFailureModes: ["rambling response"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "escalation_appropriateness",
        anchor: "Balances proactive delivery with escalation/clarification.",
        evaluationPoints: ["default path + clarifications", "escalation trigger logic"],
        evidenceSignals: ["explicit trigger criteria"],
        commonFailureModes: ["over-escalates", "under-escalates"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
    ],
    variantCatalog: JDA_AMBIGUITY_VARIANTS,
    rounds: JDA_AMBIGUITY_ROUNDS,
    sqlQueries: JDA_AMBIGUITY_ROUNDS.flatMap((round) => round.sqlQueries),
    pythonScripts: JDA_AMBIGUITY_ROUNDS.flatMap((round) => [...round.pythonScripts, ...round.rScripts]),
    coachScript: JDA_AMBIGUITY_ROUNDS.flatMap((round) => round.coachScript),
    finalResponse:
      "Happy to help. To make sure I deliver the right numbers, could you confirm:\n1) Which KPI set (CAC, MQL, pipeline, channel mix)?\n2) Which quarter (defaulting to Q4 2025 unless you prefer otherwise)?\n3) Preferred output (quick summary table vs dashboard snapshot)?\n\nDefault plan if no change:\n- Deliver Q4 KPI summary + QoQ comparison\n- Include assumptions and confidence caveats\n- Provide follow-up options for deeper cut by channel\n\nI can send the first summary in 30 minutes.",
    sampleEvents: [
      { event_type: "session_started", payload: { time_to_first_action_ms: 640 } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 22 } },
      { event_type: "python_code_run", payload: { runtime_ms: 26, has_plot: false } },
      { event_type: "analysis_r_run", payload: { runtime_ms: 31, source: "mock" } },
      { event_type: "dashboard_action", payload: { action: "annotate" } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "assumption_check" } },
    ],
    mockScoreResult: {
      confidence: 0.91,
      dimensionScores: {
        ambiguity_recognition: 0.95,
        assumption_documentation: 0.9,
        communication_clarity: 0.92,
        escalation_appropriateness: 0.88,
      },
      triggerCodes: ["strong_communication", "proactive_clarification"],
    },
    evaluationBundle: buildEvaluationBundle(
      [
        { dimension: "JD coverage", score: 90, note: "Ambiguity, assumptions, escalation covered." },
        { dimension: "Task realism", score: 87, note: "Matches common stakeholder ask ambiguity patterns." },
        { dimension: "Rubric depth", score: 88, note: "Strong communication-focused criteria." },
        { dimension: "Difficulty progression", score: 86, note: "Progression from mapping ambiguity to final response." },
      ],
      [
        { round: "Round 1", score: 88, note: "Good ambiguity mapping." },
        { round: "Round 2", score: 86, note: "Assumption framing was clear." },
        { round: "Round 3", score: 90, note: "Final stakeholder response was concise and actionable." },
      ],
      [
        { tool: "sql", score: 74 },
        { tool: "python", score: 72 },
        { tool: "r", score: 68 },
        { tool: "dashboard", score: 80 },
      ],
      [
        { code: "strong_communication", rationale: "Candidate produced concise executive-ready framing.", impact: "positive" },
        { code: "proactive_clarification", rationale: "Balanced immediate delivery with targeted questions.", impact: "positive" },
      ],
      [
        "Agent evaluator observed strong ambiguity handling and communication discipline.",
        "Additional quantitative framing could improve analytical depth for mixed-role panels.",
      ],
    ),
    datasets: [],
    parts: [],
  },

  tpl_customer_support_judgment: {
    jobDescription:
      "Customer Support Specialist: Triage a live queue, apply policy with judgment, communicate clearly under pressure, and escalate only when the evidence justifies it.",
    taskPrompt:
      "Handle a mixed queue of outage, refund, and duplicate-charge tickets. Prioritize the work, write the customer response, and revise the decision when new evidence arrives.",
    coDesignBundle: {
      roleStatement:
        "The role tests queue prioritization, policy judgment, empathy, and escalation quality under changing context.",
      objectives: [
        "Assess whether the candidate prioritizes by customer harm and SLA risk",
        "Assess whether policy is applied with defensible exception logic",
        "Assess whether written responses stay clear, calm, and actionable",
      ],
      sampleTasks: [
        "Order a mixed queue with explicit rationale",
        "Draft a customer-facing response using policy plus empathy",
        "Revise the recommendation when backend evidence changes the root cause",
      ],
      rubricBlueprint: [
        "Do not escalate without a stated trigger",
        "Do not cite policy without translating it into customer-safe language",
        "Reward decision revision when new evidence materially changes the case",
      ],
      difficultyLadder: DEFAULT_DIFFICULTY_LADDER,
      agentNotes: [
        "Strong responses balance policy adherence with customer impact rather than defaulting to denial.",
        "Penalize escalation notes that lack a clean owner, reason code, or next action.",
      ],
    },
    rubric: [
      {
        key: "queue_prioritization",
        anchor: "Orders work using customer harm, SLA risk, and business impact.",
        evaluationPoints: ["SLA-aware ordering", "rationale for priority shifts", "harm-based triage"],
        evidenceSignals: ["priority queue", "reason-code notes"],
        commonFailureModes: ["FIFO thinking", "VIP-only prioritization", "ignores outage severity"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "policy_judgment",
        anchor: "Applies policy correctly while documenting when exceptions are justified.",
        evaluationPoints: ["baseline policy read", "exception logic", "documented risk"],
        evidenceSignals: ["policy citation notes", "exception rationale"],
        commonFailureModes: ["misreads policy", "grants exception without basis", "rigid denial despite platform fault"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "escalation_quality",
        anchor: "Escalates with clean handoff details and a clear reason to involve another owner.",
        evaluationPoints: ["trigger logic", "next owner clarity", "handoff completeness"],
        evidenceSignals: ["escalation summary", "reason codes"],
        commonFailureModes: ["vague handoff", "no owner", "escalates too early"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "customer_empathy",
        anchor: "Keeps the customer response calm, specific, and respectful.",
        evaluationPoints: ["tone control", "ownership language", "clear next steps"],
        evidenceSignals: ["customer response draft"],
        commonFailureModes: ["robotic tone", "defensive language", "no next step"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "written_clarity",
        anchor: "Communicates the decision and rationale with concise, reviewable writing.",
        evaluationPoints: ["structure", "brevity", "decision visibility"],
        evidenceSignals: ["reply structure", "handoff structure"],
        commonFailureModes: ["rambling note", "missing decision", "buried rationale"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
    ],
    variantCatalog: CUSTOMER_SUPPORT_VARIANTS,
    rounds: CUSTOMER_SUPPORT_ROUNDS,
    sqlQueries: [],
    pythonScripts: [],
    coachScript: CUSTOMER_SUPPORT_ROUNDS.flatMap((round) => round.coachScript),
    finalResponse:
      "Priority order:\n1) Duplicate-charge outage ticket at SLA risk\n2) VIP refund request with possible platform-caused failure\n3) General billing question\n\nCustomer plan:\n- Acknowledge the duplicate charge and confirm we are escalating to payments because new backend evidence points to a retry issue.\n- Offer a supervised exception path on the refund because the failure appears platform-caused.\n- Give the customer a clear next update window and avoid quoting policy without explaining the decision.",
    sampleEvents: [
      { event_type: "session_started", payload: { time_to_first_action_ms: 580 } },
      { event_type: "dashboard_action", payload: { action: "sort_queue_by_sla_risk" } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "policy_exception_check" } },
      { event_type: "dashboard_action", payload: { action: "attach_backend_retry_timeline" } },
      { event_type: "verification_step_completed", payload: { step: "escalation_handoff_check" } },
    ],
    mockScoreResult: {
      confidence: 0.9,
      dimensionScores: {
        queue_prioritization: 0.92,
        policy_judgment: 0.9,
        escalation_quality: 0.88,
        customer_empathy: 0.91,
        written_clarity: 0.87,
      },
      triggerCodes: ["harm_based_triage", "policy_exception_documented", "decision_revised_with_new_evidence"],
    },
    evaluationBundle: buildEvaluationBundle(
      [
        { dimension: "JD coverage", score: 92, note: "Matches customer-support queue triage, empathy, and escalation work." },
        { dimension: "Task realism", score: 89, note: "Uses common ticketing and exception-handling pressure points." },
        { dimension: "Rubric depth", score: 90, note: "Scores concrete behaviors instead of generic soft-skill labels." },
        { dimension: "Difficulty progression", score: 88, note: "Escalates from queue ordering to policy judgment to decision revision." },
      ],
      [
        { round: "Round 1", score: 90, note: "Prioritization logic was clear and harm-based." },
        { round: "Round 2", score: 88, note: "Policy language stayed accurate while preserving empathy." },
        { round: "Round 3", score: 91, note: "Recommendation changed cleanly when new evidence arrived." },
      ],
      [{ tool: "dashboard", score: 86 }],
      [
        { code: "harm_based_triage", rationale: "Candidate prioritized by SLA risk and customer impact instead of queue order.", impact: "positive" },
        { code: "policy_exception_documented", rationale: "Exception logic was explicit and reviewable.", impact: "positive" },
        { code: "decision_revised_with_new_evidence", rationale: "Candidate updated the recommendation when backend evidence changed the case.", impact: "positive" },
      ],
      [
        "Agent evaluator observed strong policy judgment and escalation discipline.",
        "This simulation demonstrates reviewable soft-skill evidence rather than relying on generic communication scoring.",
      ],
    ),
    datasets: [
      {
        id: "support_ticket_queue",
        name: "Support Ticket Queue",
        description: "Mixed refund, outage, and duplicate-charge tickets with SLA timers and customer-tier metadata.",
        row_count: 6,
        schema: {
          columns: [
            { name: "ticket_id", dtype: "string", description: "Ticket identifier", sample_values: ["T-1042", "T-1043"] },
            { name: "issue_type", dtype: "string", description: "Primary issue category", sample_values: ["duplicate_charge", "refund_request"] },
            { name: "sla_minutes_remaining", dtype: "integer", description: "Minutes until SLA breach", sample_values: ["8", "42"] },
            { name: "customer_tier", dtype: "string", description: "Customer segment", sample_values: ["VIP", "Standard"] },
          ],
        },
        preview_rows: [
          { ticket_id: "T-1042", issue_type: "duplicate_charge", sla_minutes_remaining: 8, customer_tier: "Standard" },
          { ticket_id: "T-1043", issue_type: "refund_request", sla_minutes_remaining: 42, customer_tier: "VIP" },
        ],
      },
    ],
    parts: [],
  },

  tpl_doordash_enablement: {
    jobDescription:
      "Senior Data Analyst (Marketplace Growth): Build and defend a strategy to double unmanaged restaurant sales using SQL, Python diagnostics, and executive recommendations.",
    taskPrompt:
      "Design a 4-week fixture/live preparation flow for a DoorDash-style take-home: identify root causes, propose interventions, define pilot guardrails, and defend ROI trade-offs.",
    coDesignBundle: {
      roleStatement:
        "The role requires structured problem framing, high-integrity analysis, SQL fluency, and executive storytelling under pressure.",
      objectives: [
        "Train candidates to deliver a decision-ready 5-slide narrative in 8 minutes",
        "Train candidates to solve SQL Q1-Q4 patterns including window functions",
        "Train candidates to defend assumptions and ROI trade-offs in live probing",
      ],
      sampleTasks: [
        "Define sales proxy when GMV is unavailable and document caveats",
        "Benchmark managed vs unmanaged with funnel decomposition",
        "Design a treatment/control pilot with explicit go/no-go thresholds",
      ],
      rubricBlueprint: [
        "No recommendation without evidence chain",
        "No ROI without explicit cost model",
        "No scale decision without pilot guardrails",
      ],
      difficultyLadder: [
        { level: "Week 1", focus: "Metric framing and data QA", expectation: "Issue tree + metric taxonomy + quality checks" },
        { level: "Week 2", focus: "Root-cause and SQL fluency", expectation: "Funnel decomposition + timed SQL Q1-Q4" },
        { level: "Week 3", focus: "Strategy and ROI trade-offs", expectation: "Tiering + A/B pilot + support model comparison" },
        { level: "Week 4", focus: "Executive defense", expectation: "8-minute deck + 20-minute live Q&A resilience" },
      ],
      agentNotes: [
        "Push candidates to define success criteria before action design.",
        "Force explicit distinction between correlation evidence and causal claims.",
        "Score down recommendations that omit control group or cost guardrails.",
      ],
    },
    rubric: [
      {
        key: "problem_framing",
        anchor: "Problem framing & decomposition (15%): Defines objective, proxy metric, and assumptions with explicit success criteria.",
        evaluationPoints: [
          "Sales proxy is explicit with documented caveats",
          "Assumptions are logged with confidence levels",
          "Success threshold is measurable and tied to business outcome",
          "Issue tree covers all relevant branches before narrowing",
        ],
        evidenceSignals: ["metric taxonomy", "assumption log", "pilot threshold", "issue tree artifact"],
        commonFailureModes: ["vague objective", "implicit assumptions", "no issue tree", "skips data quality audit"],
        scoreBands: {
          "1": "No proxy definition; assumptions implicit; no structure",
          "2": "Proxy defined but caveats missing; partial assumption list",
          "3": "Proxy with caveats; assumption log present; basic issue tree",
          "4": "Strong framing with testable criteria; issue tree covers 3+ branches",
          "5": "Exemplary: proxy justified, assumptions ranked by risk, issue tree is exhaustive and prioritized",
        },
      },
      {
        key: "analysis_correctness",
        anchor: "Analysis correctness & depth (20%): Builds defensible diagnosis with checks for outliers and alternative explanations.",
        evaluationPoints: [
          "Managed/unmanaged benchmark with multiple metrics",
          "Outlier robustness checks (quartile analysis)",
          "Correlation-causation separation is explicit",
          "At least 2 alternative hypotheses considered and tested",
          "Derived fields add analytical value beyond raw columns",
        ],
        evidenceSignals: ["benchmark table", "correlation matrix", "quartile table", "validation pass", "alternative hypothesis log"],
        commonFailureModes: ["single-slice analysis", "causal over-claim from correlation", "no outlier check", "ignores confounders"],
        scoreBands: {
          "1": "No benchmark; single metric used; causal claims from correlation",
          "2": "Basic benchmark but single-dimension; no outlier check",
          "3": "Multi-metric benchmark; correlation flagged; one alternative hypothesis",
          "4": "Quartile analysis included; 2+ alternatives tested; confounders addressed",
          "5": "Exemplary: comprehensive 14-variable correlation, quartile robustness, explicit causation boundary, funnel decomposition",
        },
      },
      {
        key: "recommendation_quality",
        anchor: "Recommendation & pilot design (20%): Recommends prioritized interventions mapped to diagnosed root causes with a rigorous pilot specification.",
        evaluationPoints: [
          "Action-to-gap mapping is explicit (intervention traces to root cause)",
          "Tiered prioritization with clear criteria",
          "Treatment/control pilot design with sample sizes",
          "Go/no-go thresholds are measurable",
          "Execution sequence is logical and phased",
        ],
        evidenceSignals: ["intervention matrix", "tier plan", "pilot spec", "go/no-go criteria"],
        commonFailureModes: ["generic actions", "no sequencing", "no control group", "missing go/no-go threshold"],
        scoreBands: {
          "1": "Generic recommendations; no tier logic; no pilot design",
          "2": "Some action-to-gap mapping; tiers exist but criteria are vague",
          "3": "Clear tiering; pilot mentioned; basic go/no-go criteria",
          "4": "Treatment/control design with sample justification; measurable thresholds",
          "5": "Exemplary: intervention matrix, tier criteria, sample size calculation, phased rollout, explicit scale conditions",
        },
      },
      {
        key: "tradeoff_roi_rigor",
        anchor: "Trade-off & ROI rigor (15%): Quantifies pilot economics and support model trade-offs with clear go/no-go criteria.",
        evaluationPoints: [
          "ROI model includes revenue, cost, and profit for multiple scenarios",
          "Support model comparison is quantitative (not just qualitative)",
          "Sensitivity analysis tests key assumptions",
          "Breakeven conditions are explicitly stated",
          "Scale trigger clarity with capital efficiency framing",
        ],
        evidenceSignals: ["roi table", "sensitivity matrix", "guardrail thresholds", "payback period", "breakeven analysis"],
        commonFailureModes: ["missing cost assumptions", "no sensitivity analysis", "qualitative-only comparison", "ignores negative base-case ROI"],
        scoreBands: {
          "1": "No ROI model; costs omitted; qualitative hand-waving",
          "2": "Basic revenue estimate; costs present but incomplete",
          "3": "Full ROI for one model; basic cost comparison",
          "4": "Multi-model ROI with sensitivity; breakeven conditions stated",
          "5": "Exemplary: 3-model comparison, sensitivity matrix, payback analysis, explicit pivot conditions for sub-1x base case",
        },
      },
      {
        key: "communication_story",
        anchor: "Communication & data story (15%): Delivers concise executive narrative that is resilient under challenge questions.",
        evaluationPoints: [
          "Decision-first headline on every slide",
          "Pyramid principle structure (situation, complication, resolution)",
          "Only decision-relevant charts included (appendix for the rest)",
          "Q&A defense quality under probing",
          "Numbers on slides traceable to source queries",
        ],
        evidenceSignals: ["slide logic", "challenge-response coherence", "chart audit log", "QA checklist"],
        commonFailureModes: ["chart overload", "unclear decision ask", "no pyramid structure", "cannot defend under probing"],
        scoreBands: {
          "1": "No narrative structure; chart dump; collapses under questioning",
          "2": "Some structure; too many charts; weak defense",
          "3": "Clear 5-slide flow; mostly decision-focused; adequate defense",
          "4": "Pyramid principle applied; charts audited; handles most probes",
          "5": "Exemplary: crisp pyramid narrative, QA-verified numbers, resilient defense across hiring manager, data lead, and finance probes",
        },
      },
      {
        key: "sql_proficiency",
        anchor: "SQL proficiency (15%): Executes SQL from basic counts to window-function cumulative reporting accurately.",
        evaluationPoints: [
          "Correct filtering and grouping (Q1 level)",
          "Join correctness with subqueries (Q2-Q3 level)",
          "Window-function correctness including running totals (Q4 level)",
          "Query readability and commenting",
          "Timed execution under interview pressure",
        ],
        evidenceSignals: ["q1_q4_sql_set", "query sanity checks", "timing log", "verification of window function output"],
        commonFailureModes: ["double counting", "incorrect running total logic", "join explosion", "filter mismatch in subqueries"],
        scoreBands: {
          "1": "Cannot write correct GROUP BY; basic syntax errors",
          "2": "Q1 correct; Q2 has join issues; Q3-Q4 not attempted",
          "3": "Q1-Q2 correct; Q3 mostly correct; Q4 attempted with errors",
          "4": "Q1-Q3 correct; Q4 correct after one iteration",
          "5": "Exemplary: all 4 correct on first attempt, readable style, verified outputs, completed within time limit",
        },
      },
    ],
    variantCatalog: DOORDASH_ENABLEMENT_VARIANTS,
    rounds: DOORDASH_ENABLEMENT_ROUNDS,
    sqlQueries: DOORDASH_ENABLEMENT_ROUNDS.flatMap((round) => round.sqlQueries),
    pythonScripts: DOORDASH_ENABLEMENT_ROUNDS.flatMap((round) => [...round.pythonScripts, ...round.rScripts]),
    coachScript: DOORDASH_ENABLEMENT_ROUNDS.flatMap((round) => round.coachScript),
    finalResponse:
      "Recommendation summary:\n1) Use deliveries as the operational sales proxy (explicit caveat: GMV unavailable in dataset).\n2) Prioritize Tier-1 unmanaged restaurants for a 4-week, 10-treatment/10-control pilot.\n3) Bundle three interventions: ads credit (discovery), menu refresh (conversion), order-protocol stabilization (reliability).\n4) Scale only if pilot clears >30% order lift at < $200 variable support cost per store and no material retention decay post-credit.\n\nRationale: managed vs unmanaged gaps are largest on discovery and conversion metrics, while AOV differences are modest. Shared support model yields better capital efficiency than dedicated-AM staffing for initial rollout.",
    sampleEvents: [
      // Round 1 - Data loading & metric definition
      { event_type: "session_started", payload: { time_to_first_action_ms: 710, round: "round_1" } },
      { event_type: "sql_query_run", payload: { row_count: 2, runtime_ms: 41, round: "round_1" } },
      { event_type: "sql_query_run", payload: { row_count: 2, runtime_ms: 29, round: "round_1" } },
      { event_type: "sql_query_run", payload: { row_count: 2, runtime_ms: 34, round: "round_1" } },
      { event_type: "python_code_run", payload: { runtime_ms: 58, has_plot: false, round: "round_1" } },
      { event_type: "dashboard_action", payload: { action: "annotate_proxy_metric", round: "round_1" } },
      { event_type: "copilot_invoked", payload: { source: "coach", round: "round_1" } },
      // Round 2 - Derived fields & benchmarking
      { event_type: "sql_query_run", payload: { row_count: 2, runtime_ms: 36, round: "round_2" } },
      { event_type: "sql_query_run", payload: { row_count: 2, runtime_ms: 32, round: "round_2" } },
      { event_type: "python_code_run", payload: { runtime_ms: 72, has_plot: false, round: "round_2" } },
      { event_type: "python_code_run", payload: { runtime_ms: 64, has_plot: true, round: "round_2" } },
      { event_type: "dashboard_action", payload: { action: "annotate_top3_gaps", round: "round_2" } },
      { event_type: "copilot_invoked", payload: { source: "coach", round: "round_2" } },
      // Round 3 - Correlation & quartile analysis
      { event_type: "sql_query_run", payload: { row_count: 4, runtime_ms: 52, round: "round_3" } },
      { event_type: "sql_query_run", payload: { row_count: 1, runtime_ms: 38, round: "round_3" } },
      { event_type: "python_code_run", payload: { runtime_ms: 85, has_plot: false, round: "round_3" } },
      { event_type: "python_code_run", payload: { runtime_ms: 91, has_plot: true, round: "round_3" } },
      { event_type: "copilot_invoked", payload: { source: "coach", round: "round_3" } },
      { event_type: "verification_step_completed", payload: { step: "correlation_causation_check", round: "round_3" } },
      // Round 4 - Timed SQL drill Q1-Q4
      { event_type: "sql_query_run", payload: { row_count: 5, runtime_ms: 44, round: "round_4", question: "Q1" } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 61, round: "round_4", question: "Q2" } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 78, round: "round_4", question: "Q3" } },
      { event_type: "sql_query_run", payload: { row_count: 6, runtime_ms: 95, round: "round_4", question: "Q4" } },
      { event_type: "python_code_run", payload: { runtime_ms: 33, has_plot: false, round: "round_4" } },
      // Round 5 - Intervention design & pilot
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 47, round: "round_5" } },
      { event_type: "sql_query_run", payload: { row_count: 5, runtime_ms: 53, round: "round_5" } },
      { event_type: "python_code_run", payload: { runtime_ms: 42, has_plot: false, round: "round_5" } },
      { event_type: "python_code_run", payload: { runtime_ms: 67, has_plot: true, round: "round_5" } },
      { event_type: "dashboard_action", payload: { action: "set_go_nogo_threshold", round: "round_5" } },
      { event_type: "copilot_invoked", payload: { source: "coach", round: "round_5" } },
      // Round 6 - ROI model & support comparison
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 39, round: "round_6" } },
      { event_type: "python_code_run", payload: { runtime_ms: 55, has_plot: false, round: "round_6" } },
      { event_type: "python_code_run", payload: { runtime_ms: 48, has_plot: false, round: "round_6" } },
      { event_type: "python_code_run", payload: { runtime_ms: 71, has_plot: true, round: "round_6" } },
      { event_type: "verification_step_completed", payload: { step: "roi_sanity_check", round: "round_6" } },
      { event_type: "copilot_invoked", payload: { source: "coach", round: "round_6" } },
      // Round 7 - Deck polish & QA
      { event_type: "sql_query_run", payload: { row_count: 4, runtime_ms: 35, round: "round_7" } },
      { event_type: "python_code_run", payload: { runtime_ms: 44, has_plot: false, round: "round_7" } },
      { event_type: "dashboard_action", payload: { action: "chart_audit", round: "round_7" } },
      { event_type: "verification_step_completed", payload: { step: "slide_number_qa", round: "round_7" } },
      // Round 8 - Mock interview
      { event_type: "dashboard_action", payload: { action: "start_presentation_timer", round: "round_8" } },
      { event_type: "copilot_invoked", payload: { source: "interviewer_hiring_manager", round: "round_8" } },
      { event_type: "copilot_invoked", payload: { source: "interviewer_data_lead", round: "round_8" } },
      { event_type: "copilot_invoked", payload: { source: "interviewer_finance_partner", round: "round_8" } },
      { event_type: "verification_step_completed", payload: { step: "mock_interview_complete", round: "round_8" } },
    ],
    mockScoreResult: {
      confidence: 0.89,
      // Weights: problem_framing 15%, analysis_correctness 20%, recommendation_quality 20%,
      //          tradeoff_roi_rigor 15%, communication_story 15%, sql_proficiency 15%
      dimensionScores: {
        problem_framing: 0.91,        // 15% weight
        analysis_correctness: 0.88,   // 20% weight
        recommendation_quality: 0.87, // 20% weight
        tradeoff_roi_rigor: 0.9,      // 15% weight
        communication_story: 0.86,    // 15% weight
        sql_proficiency: 0.86,        // 15% weight
      },
      triggerCodes: ["pilot_design_rigorous", "roi_tradeoff_quantified", "fixture_program_4week", "sql_window_functions_correct", "correlation_causation_separated"],
    },
    evaluationBundle: buildEvaluationBundle(
      [
        { dimension: "JD coverage", score: 95, note: "Matches analyst take-home + live deep-dive competencies." },
        { dimension: "Task realism", score: 94, note: "Case flow mirrors real marketplace strategy interviews." },
        { dimension: "Rubric depth", score: 93, note: "Six-dimension scorecard with weights (15/20/20/15/15/15) is evidence-linked and decision-oriented." },
        { dimension: "Difficulty progression", score: 96, note: "Eight-round, four-week ladder from data loading through live mock interview." },
      ],
      [
        { round: "Round 1 (W1a)", score: 88, note: "Data loading and metric proxy definition were thorough. Assumption log started early." },
        { round: "Round 2 (W1b)", score: 89, note: "Derived fields and benchmarking identified the 4.25x gap clearly. Top 3 gaps well-justified." },
        { round: "Round 3 (W2a)", score: 87, note: "Correlation analysis was solid. Correctly flagged correlation-causation boundary." },
        { round: "Round 4 (W2b)", score: 85, note: "SQL Q1-Q3 completed accurately. Q4 window function required one iteration." },
        { round: "Round 5 (W3a)", score: 90, note: "Intervention matrix mapped directly to diagnosed gaps. Pilot design included sample size logic." },
        { round: "Round 6 (W3b)", score: 91, note: "ROI model was comprehensive. Sensitivity analysis correctly identified breakeven conditions." },
        { round: "Round 7 (W4a)", score: 88, note: "Pyramid-principle storyboard was clean. QA pass caught one stale number from early analysis." },
        { round: "Round 8 (W4b)", score: 89, note: "Mock interview defense was strong. Handled finance challenge on sub-1x ROI with pilot framing." },
      ],
      [
        { tool: "sql", score: 88 },
        { tool: "python", score: 85 },
        { tool: "r", score: 0 },
        { tool: "dashboard", score: 86 },
      ],
      [
        { code: "pilot_design_rigorous", rationale: "Defined treatment/control with measurable guardrails and sample size justification.", impact: "positive" },
        { code: "roi_tradeoff_quantified", rationale: "Compared three support models on ROI, payback, and sensitivity bounds.", impact: "positive" },
        { code: "fixture_program_4week", rationale: "Completed full 8-round, 4-week progression under deterministic fixture.", impact: "positive" },
        { code: "sql_window_functions_correct", rationale: "Q4 cumulative SUM OVER pattern executed correctly after one iteration.", impact: "positive" },
        { code: "correlation_causation_separated", rationale: "Consistently framed correlation evidence as prioritization signal, not causal claim.", impact: "positive" },
      ],
      [
        "Agent evaluator observed clear progression from data exploration through executive defense across 8 rounds.",
        "Strongest performance in ROI modeling (Round 6) and intervention design (Round 5).",
        "SQL fluency improved notably between Round 1 basic queries and Round 4 window functions.",
        "Mock interview (Round 8) showed resilience under probing, particularly on the finance challenge.",
        "Most residual risk came from assumptions around post-credit retention persistence.",
      ],
    ),
    datasets: [
      {
        id: "doordash_restaurant_data",
        name: "doordash_restaurant_data",
        description:
          "Restaurant-level performance data for 100 DoorDash restaurants in the Atlanta metro area. Contains 40 managed and 60 unmanaged restaurants with operational, marketing, and delivery metrics over a trailing 30-day window.",
        row_count: 100,
        schema: {
          columns: [
            { name: "restaurant_id", dtype: "string", description: "Unique restaurant identifier", sample_values: ["R001", "R005", "R042"] },
            { name: "restaurant_name", dtype: "string", description: "Restaurant name", sample_values: ["Peachtree Grill", "Buckhead Bistro", "Midtown Wok"] },
            { name: "cuisine_type", dtype: "string", description: "Primary cuisine category", sample_values: ["American", "Mexican", "Chinese", "Italian", "Indian"] },
            { name: "neighborhood", dtype: "string", description: "Atlanta neighborhood", sample_values: ["Midtown", "Buckhead", "Decatur", "East Atlanta", "Westside"] },
            { name: "is_managed", dtype: "boolean", description: "Whether restaurant has a dedicated account manager (1=managed, 0=unmanaged)", sample_values: ["0", "1"] },
            { name: "monthly_orders", dtype: "int", description: "Total orders in the past 30 days", sample_values: ["45", "312", "1205"] },
            { name: "avg_order_value", dtype: "float", description: "Average order value in USD", sample_values: ["18.50", "24.75", "21.30"] },
            { name: "monthly_revenue", dtype: "float", description: "Monthly revenue in USD (orders x AOV)", sample_values: ["832.50", "7722.00", "25663.50"] },
            { name: "conversion_rate", dtype: "float", description: "Visitor-to-order conversion rate (0 to 1 scale)", sample_values: ["0.03", "0.08", "0.052"] },
            { name: "page_views", dtype: "int", description: "Monthly page views on DoorDash platform", sample_values: ["250", "3500", "1420"] },
            { name: "menu_item_count", dtype: "int", description: "Number of items on the restaurant menu", sample_values: ["32", "85", "54"] },
            { name: "has_photos", dtype: "boolean", description: "Whether menu items have photos (1=yes, 0=no)", sample_values: ["0", "1"] },
            { name: "avg_delivery_time_min", dtype: "float", description: "Average delivery time in minutes", sample_values: ["32.5", "41.0", "28.3"] },
            { name: "customer_rating", dtype: "float", description: "Average customer rating (1.0 to 5.0)", sample_values: ["4.2", "3.8", "4.6"] },
            { name: "review_count", dtype: "int", description: "Total number of customer reviews", sample_values: ["28", "142", "310"] },
            { name: "promo_spend_usd", dtype: "float", description: "Monthly promotional spend in USD (nullable)", sample_values: ["0.0", "45.00", "120.00"] },
            { name: "days_on_platform", dtype: "int", description: "Number of days since restaurant joined DoorDash", sample_values: ["90", "365", "730"] },
            { name: "avg_prep_time_min", dtype: "float", description: "Average food preparation time in minutes", sample_values: ["18.0", "25.5", "12.0"] },
            { name: "reorder_rate", dtype: "float", description: "Percentage of orders from repeat customers (0 to 1)", sample_values: ["0.15", "0.42", "0.38"] },
            { name: "cancellation_rate", dtype: "float", description: "Order cancellation rate (0 to 1 scale)", sample_values: ["0.02", "0.08", "0.04"] },
            { name: "dasher_rating", dtype: "float", description: "Average Dasher (driver) rating for this restaurant (1.0 to 5.0)", sample_values: ["4.5", "4.1", "4.8"] },
            { name: "order_protocol", dtype: "string", description: "How orders are received: POS, IPAD, EMAIL, or FAX", sample_values: ["POS", "IPAD", "EMAIL", "FAX"] },
            { name: "has_storefront", dtype: "boolean", description: "Whether restaurant has a DoorDash storefront page (1=yes, 0=no)", sample_values: ["0", "1"] },
            { name: "peak_hour_pct", dtype: "float", description: "Percentage of orders during peak hours 11am-1pm and 5pm-9pm (0 to 1)", sample_values: ["0.55", "0.72", "0.68"] },
            { name: "competitor_count", dtype: "int", description: "Number of competing restaurants within 1-mile radius on DoorDash", sample_values: ["8", "22", "15"] },
          ],
        },
        preview_rows: [
          {
            restaurant_id: "R001", restaurant_name: "Peachtree Grill", cuisine_type: "American", neighborhood: "Midtown",
            is_managed: 1, monthly_orders: 1205, avg_order_value: 23.4, monthly_revenue: 28197.0, conversion_rate: 0.082,
            page_views: 14695, menu_item_count: 72, has_photos: 1, avg_delivery_time_min: 28.3, customer_rating: 4.6,
            review_count: 310, promo_spend_usd: 120.0, days_on_platform: 730, avg_prep_time_min: 15.0, reorder_rate: 0.42,
            cancellation_rate: 0.02, dasher_rating: 4.8, order_protocol: "POS", has_storefront: 1, peak_hour_pct: 0.68, competitor_count: 18,
          },
          {
            restaurant_id: "R005", restaurant_name: "Buckhead Bistro", cuisine_type: "Italian", neighborhood: "Buckhead",
            is_managed: 1, monthly_orders: 842, avg_order_value: 29.9, monthly_revenue: 25175.8, conversion_rate: 0.071,
            page_views: 11859, menu_item_count: 85, has_photos: 1, avg_delivery_time_min: 31.2, customer_rating: 4.4,
            review_count: 248, promo_spend_usd: 95.0, days_on_platform: 540, avg_prep_time_min: 22.0, reorder_rate: 0.38,
            cancellation_rate: 0.03, dasher_rating: 4.5, order_protocol: "POS", has_storefront: 1, peak_hour_pct: 0.72, competitor_count: 22,
          },
          {
            restaurant_id: "R012", restaurant_name: "Decatur Deli", cuisine_type: "American", neighborhood: "Decatur",
            is_managed: 0, monthly_orders: 312, avg_order_value: 18.5, monthly_revenue: 5772.0, conversion_rate: 0.038,
            page_views: 8211, menu_item_count: 45, has_photos: 0, avg_delivery_time_min: 35.8, customer_rating: 4.0,
            review_count: 88, promo_spend_usd: 25.0, days_on_platform: 365, avg_prep_time_min: 18.0, reorder_rate: 0.22,
            cancellation_rate: 0.05, dasher_rating: 4.2, order_protocol: "IPAD", has_storefront: 0, peak_hour_pct: 0.61, competitor_count: 12,
          },
          {
            restaurant_id: "R023", restaurant_name: "Midtown Wok", cuisine_type: "Chinese", neighborhood: "Midtown",
            is_managed: 0, monthly_orders: 178, avg_order_value: 20.1, monthly_revenue: 3577.8, conversion_rate: 0.022,
            page_views: 8091, menu_item_count: 62, has_photos: 0, avg_delivery_time_min: 42.1, customer_rating: 3.7,
            review_count: 52, promo_spend_usd: null, days_on_platform: 210, avg_prep_time_min: 25.0, reorder_rate: 0.18,
            cancellation_rate: 0.07, dasher_rating: 4.0, order_protocol: "EMAIL", has_storefront: 0, peak_hour_pct: 0.55, competitor_count: 20,
          },
          {
            restaurant_id: "R034", restaurant_name: "East ATL Tacos", cuisine_type: "Mexican", neighborhood: "East Atlanta",
            is_managed: 0, monthly_orders: 245, avg_order_value: 16.8, monthly_revenue: 4116.0, conversion_rate: 0.034,
            page_views: 7206, menu_item_count: 38, has_photos: 1, avg_delivery_time_min: 33.5, customer_rating: 4.1,
            review_count: 95, promo_spend_usd: 40.0, days_on_platform: 300, avg_prep_time_min: 14.0, reorder_rate: 0.28,
            cancellation_rate: 0.04, dasher_rating: 4.3, order_protocol: "IPAD", has_storefront: 0, peak_hour_pct: 0.65, competitor_count: 14,
          },
          {
            restaurant_id: "R041", restaurant_name: "Ponce Taqueria", cuisine_type: "Mexican", neighborhood: "Midtown",
            is_managed: 0, monthly_orders: 98, avg_order_value: 15.2, monthly_revenue: 1489.6, conversion_rate: 0.028,
            page_views: 3500, menu_item_count: 28, has_photos: 0, avg_delivery_time_min: 38.4, customer_rating: 3.9,
            review_count: 34, promo_spend_usd: null, days_on_platform: 150, avg_prep_time_min: 16.0, reorder_rate: 0.15,
            cancellation_rate: 0.06, dasher_rating: 4.1, order_protocol: "EMAIL", has_storefront: 0, peak_hour_pct: 0.58, competitor_count: 19,
          },
          {
            restaurant_id: "R055", restaurant_name: "Westside Curry House", cuisine_type: "Indian", neighborhood: "Westside",
            is_managed: 1, monthly_orders: 680, avg_order_value: 22.8, monthly_revenue: 15504.0, conversion_rate: 0.065,
            page_views: 10462, menu_item_count: 54, has_photos: 1, avg_delivery_time_min: 34.0, customer_rating: 4.3,
            review_count: 186, promo_spend_usd: 85.0, days_on_platform: 480, avg_prep_time_min: 20.0, reorder_rate: 0.35,
            cancellation_rate: 0.03, dasher_rating: 4.6, order_protocol: "POS", has_storefront: 1, peak_hour_pct: 0.70, competitor_count: 10,
          },
          {
            restaurant_id: "R068", restaurant_name: "Little Five Pizza", cuisine_type: "Italian", neighborhood: "East Atlanta",
            is_managed: 0, monthly_orders: 45, avg_order_value: 19.6, monthly_revenue: 882.0, conversion_rate: 0.018,
            page_views: 2500, menu_item_count: 22, has_photos: 0, avg_delivery_time_min: 45.2, customer_rating: 3.5,
            review_count: 18, promo_spend_usd: 0.0, days_on_platform: 90, avg_prep_time_min: 28.0, reorder_rate: 0.10,
            cancellation_rate: 0.09, dasher_rating: 3.9, order_protocol: "FAX", has_storefront: 0, peak_hour_pct: 0.52, competitor_count: 16,
          },
          {
            restaurant_id: "R079", restaurant_name: "Piedmont BBQ", cuisine_type: "American", neighborhood: "Buckhead",
            is_managed: 1, monthly_orders: 1502, avg_order_value: 24.75, monthly_revenue: 37174.5, conversion_rate: 0.091,
            page_views: 16505, menu_item_count: 48, has_photos: 1, avg_delivery_time_min: 26.8, customer_rating: 4.7,
            review_count: 420, promo_spend_usd: 150.0, days_on_platform: 900, avg_prep_time_min: 12.0, reorder_rate: 0.48,
            cancellation_rate: 0.01, dasher_rating: 4.9, order_protocol: "POS", has_storefront: 1, peak_hour_pct: 0.75, competitor_count: 25,
          },
          {
            restaurant_id: "R092", restaurant_name: "College Park Wings", cuisine_type: "American", neighborhood: "College Park",
            is_managed: 0, monthly_orders: 12, avg_order_value: 14.2, monthly_revenue: 170.4, conversion_rate: 0.008,
            page_views: 1500, menu_item_count: 18, has_photos: 0, avg_delivery_time_min: 52.0, customer_rating: 3.2,
            review_count: 6, promo_spend_usd: 0.0, days_on_platform: 45, avg_prep_time_min: 30.0, reorder_rate: 0.05,
            cancellation_rate: 0.12, dasher_rating: 3.7, order_protocol: "FAX", has_storefront: 0, peak_hour_pct: 0.48, competitor_count: 8,
          },
        ],
      },
    ],
    parts: [
      {
        id: "part-exploration",
        title: "Data Exploration",
        description: "Load the dataset, define what 'double sales' means, establish analytical baseline, and perform data quality audit.",
        part_type: "exploration",
        time_limit_minutes: 120,
        deliverable_type: "notebook",
      },
      {
        id: "part-analysis",
        title: "Root-Cause Analysis & SQL",
        description: "Quantify the managed vs unmanaged gap, identify root causes with correlation analysis, and complete SQL proficiency questions.",
        part_type: "analysis",
        time_limit_minutes: 120,
        deliverable_type: "notebook",
      },
      {
        id: "part-strategy",
        title: "Strategy & ROI Modeling",
        description: "Design interventions, build tiering logic, create pilot design, and model ROI with unit economics.",
        part_type: "strategy",
        time_limit_minutes: 150,
        deliverable_type: "report",
      },
      {
        id: "part-presentation",
        title: "Executive Narrative",
        description: "Polish 5-slide deliverable using pyramid principle, annotated charts, and executive summary with headline numbers.",
        part_type: "presentation",
        time_limit_minutes: 150,
        deliverable_type: "report",
      },
    ],
  },
}
