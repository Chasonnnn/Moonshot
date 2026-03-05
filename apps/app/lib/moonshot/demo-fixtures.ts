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

const DOORDASH_ENABLEMENT_VARIANTS = buildVariantCatalog(
  "Solve a DoorDash-style marketplace case with a measurable growth strategy, SQL proof, and executive-ready narrative.",
  ["problem_framing", "sql", "python", "experiments", "roi", "storytelling"],
)

const DOORDASH_ENABLEMENT_ROUNDS: DemoRound[] = [
  {
    id: "round_1",
    title: "Week 1 - Case Decomposition and Data QA",
    objective: "Define the sales proxy, map the issue tree, and identify data quality risks before analysis.",
    deliverables: ["Issue tree", "Metric taxonomy", "Data cleaning checklist"],
    sqlQueries: [
      {
        query:
          "SELECT management_type, AVG(deliveries_l30) AS avg_deliveries, AVG(weekly_page_views) AS avg_views, AVG(conversion_rate) AS avg_conv FROM atl_restaurants GROUP BY management_type;",
        columns: ["management_type", "avg_deliveries", "avg_views", "avg_conv"],
        rows: [
          { management_type: "Managed", avg_deliveries: 313.2, avg_views: 314.2, avg_conv: 0.2869 },
          { management_type: "Unmanaged", avg_deliveries: 68.4, avg_views: 120.3, avg_conv: 0.1395 },
        ],
      },
      {
        query:
          "SELECT COUNT(*) AS mixed_scale_fields FROM data_dictionary WHERE field_name IN ('conversion_rate','pct_cancellations') AND scale_type IN ('0_to_1','0_to_100');",
        columns: ["mixed_scale_fields"],
        rows: [{ mixed_scale_fields: 2 }],
      },
    ],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Open ATL marketplace overview", "Annotate proxy metric decision", "Flag mixed-scale percentage fields"],
    coachScript: [
      {
        role: "user",
        content: "The prompt says double sales but there is no GMV. Is deliveries a valid proxy?",
        allowed: true,
      },
      {
        role: "coach",
        content: "Yes, if you state the assumption explicitly and include caveats about AOV and take-rate differences.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["week1_issue_tree.md", "week1_metric_taxonomy.csv"],
  },
  {
    id: "round_2",
    title: "Week 2 - Root-Cause Analysis and SQL Fluency",
    objective: "Prove the key levers behind unmanaged underperformance and solve SQL Q1-Q4 patterns.",
    deliverables: ["Benchmark table", "Funnel decomposition", "Timed SQL answers"],
    sqlQueries: [
      {
        query:
          "SELECT DATE_TRUNC('month', date) AS month, SUM(order_value) AS monthly_sales, SUM(SUM(order_value)) OVER (ORDER BY DATE_TRUNC('month', date)) AS cumulative_sales FROM delivery_data WHERE store_id IN (SELECT DISTINCT store_id FROM owner_mapping WHERE account_owner IN ('Kevin','Carla')) GROUP BY DATE_TRUNC('month', date) ORDER BY month;",
        columns: ["month", "monthly_sales", "cumulative_sales"],
        rows: [
          { month: "2019-06-01", monthly_sales: 8421.2, cumulative_sales: 8421.2 },
          { month: "2019-07-01", monthly_sales: 9018.7, cumulative_sales: 17439.9 },
          { month: "2019-08-01", monthly_sales: 9302.4, cumulative_sales: 26742.3 },
        ],
      },
    ],
    pythonScripts: [
      {
        code:
          'import pandas as pd\n\ndf = pd.read_csv(DATASET_PATH)\nsummary = df.groupby("management_type")[["weekly_page_views", "conversion_rate", "deliveries_l30"]].mean().round(3)\nprint(summary)\nprint("managed_to_unmanaged_delivery_ratio", round(summary.loc["Managed", "deliveries_l30"] / summary.loc["Unmanaged", "deliveries_l30"], 2))',
        stdout:
          "                 weekly_page_views  conversion_rate  deliveries_l30\nmanagement_type                                                      \nManaged                     314.200            0.287          313.200\nUnmanaged                   120.300            0.139           68.400\nmanaged_to_unmanaged_delivery_ratio 4.58",
        datasetId: "atl_unmanaged_funnel_v1",
      },
      {
        code:
          'import pandas as pd\nimport matplotlib.pyplot as plt\n\ndf = pd.read_csv(DATASET_PATH)\nunmanaged = df[df[\"management_type\"] == \"Unmanaged\"]\nplt.scatter(unmanaged[\"weekly_page_views\"], unmanaged[\"deliveries_l30\"])\nplt.xlabel(\"weekly_page_views\")\nplt.ylabel(\"deliveries_l30\")\nplt.title(\"Unmanaged ATL: Discovery vs Deliveries\")\nplt.show()',
        stdout: "",
        plotUrl: "/runtime/plot_1.png",
        datasetId: "atl_unmanaged_funnel_v1",
      },
    ],
    rScripts: [],
    dashboardActions: ["Open managed vs unmanaged scorecard", "Annotate discovery and conversion gaps", "Log SQL Q4 window-function checkpoint"],
    coachScript: [
      {
        role: "user",
        content: "My correlation is high for page views. Can I claim causation?",
        allowed: true,
      },
      {
        role: "coach",
        content: "No. Treat it as a prioritization signal and pair it with pilot design for causal validation.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["week2_benchmark.csv", "week2_sql_timed_set.md"],
  },
  {
    id: "round_3",
    title: "Week 3 - Strategy, Pilot, and ROI Trade-Offs",
    objective: "Prioritize interventions, design control/treatment pilot, and compare support cost models.",
    deliverables: ["Tiered rollout plan", "A/B pilot spec", "ROI model"],
    sqlQueries: [
      {
        query:
          "SELECT tier, COUNT(*) AS restaurant_count, AVG(deliveries_l30) AS avg_deliveries FROM tiered_unmanaged GROUP BY tier ORDER BY tier;",
        columns: ["tier", "restaurant_count", "avg_deliveries"],
        rows: [
          { tier: "Tier 1", restaurant_count: 35, avg_deliveries: 269.0 },
          { tier: "Tier 2", restaurant_count: 35, avg_deliveries: 67.0 },
          { tier: "Tier 3", restaurant_count: 36, avg_deliveries: 16.0 },
        ],
      },
    ],
    pythonScripts: [
      {
        code:
          'import pandas as pd\n\ndf = pd.read_csv(DATASET_PATH)\ndf["annual_incremental_revenue"] = df["restaurants_supported"] * df["monthly_orders_lift_per_store"] * df["aov_usd"] * df["take_rate"] * 12\ndf["annual_support_cost"] = df["restaurants_supported"] * df["variable_cost_per_store_usd"] * 12\ndf["roi_multiple"] = (df["annual_incremental_revenue"] / df["annual_support_cost"]).round(2)\nprint(df[["support_model", "roi_multiple"]].sort_values("roi_multiple", ascending=False))',
        stdout:
          "      support_model  roi_multiple\n0      shared_team          6.76\n2  automation_first          6.63\n1      dedicated_am          4.14",
        datasetId: "pilot_cost_scenarios_v1",
      },
    ],
    rScripts: [],
    dashboardActions: ["Open pilot design canvas", "Set go/no-go thresholds", "Compare shared-team vs dedicated-AM scenarios"],
    coachScript: [
      {
        role: "user",
        content: "How should I justify choosing shared support over dedicated AMs?",
        allowed: true,
      },
      {
        role: "coach",
        content: "Anchor to ROI per support dollar, time-to-scale, and whether the pilot threshold remains above your cost guardrail.",
        allowed: true,
      },
    ],
    mockedArtifacts: ["week3_pilot_design.md", "week3_roi_model.csv"],
  },
  {
    id: "round_4",
    title: "Week 4 - Executive Narrative and Live Defense",
    objective: "Deliver the 5-slide recommendation in 8 minutes and defend under probing.",
    deliverables: ["Final 5-slide storyline", "Q&A defense log", "Revision actions"],
    sqlQueries: [],
    pythonScripts: [],
    rScripts: [],
    dashboardActions: ["Run 8-minute mock timer", "Capture red-team interviewer questions", "Log revision decisions"],
    coachScript: [
      {
        role: "user",
        content: "I have too many charts. What should stay in the final 5 slides?",
        allowed: true,
      },
      {
        role: "coach",
        content: "Keep only charts tied to a decision: baseline gap, root-cause proof, pilot design, and ROI trade-off.",
        allowed: true,
      },
      {
        role: "user",
        content: "Can you generate my final slides for me?",
        allowed: false,
        policyReason: "Direct submission generation is blocked in assessment mode.",
      },
    ],
    mockedArtifacts: ["week4_final_storyboard.pdf", "week4_live_defense_notes.md"],
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
        anchor: "Defines objective, proxy metric, and assumptions with explicit success criteria.",
        evaluationPoints: ["Sales proxy is explicit", "Assumptions are logged", "Success threshold is measurable"],
        evidenceSignals: ["metric taxonomy", "assumption log", "pilot threshold"],
        commonFailureModes: ["vague objective", "implicit assumptions"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "analysis_correctness",
        anchor: "Builds defensible diagnosis with checks for outliers and alternative explanations.",
        evaluationPoints: ["Managed/unmanaged benchmark", "Outlier robustness checks", "Correlation-causation separation"],
        evidenceSignals: ["benchmark table", "validation pass", "alternative hypothesis"],
        commonFailureModes: ["single-slice analysis", "causal over-claim"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "recommendation_quality",
        anchor: "Recommends prioritized interventions mapped to diagnosed root causes.",
        evaluationPoints: ["Action-to-gap mapping", "Tiered prioritization", "Execution sequence clarity"],
        evidenceSignals: ["intervention matrix", "tier plan"],
        commonFailureModes: ["generic actions", "no sequencing"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "tradeoff_roi_rigor",
        anchor: "Quantifies pilot economics and support model trade-offs with clear go/no-go criteria.",
        evaluationPoints: ["Treatment/control design", "Cost model completeness", "Scale trigger clarity"],
        evidenceSignals: ["roi table", "guardrail thresholds"],
        commonFailureModes: ["missing cost assumptions", "no control group"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "communication_story",
        anchor: "Delivers concise executive narrative that is resilient under challenge questions.",
        evaluationPoints: ["Decision-first headline", "Narrative flow", "Q&A defense quality"],
        evidenceSignals: ["slide logic", "challenge-response coherence"],
        commonFailureModes: ["chart overload", "unclear decision ask"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
      },
      {
        key: "sql_proficiency",
        anchor: "Executes SQL from basic counts to window-function cumulative reporting accurately.",
        evaluationPoints: ["Correct filtering and grouping", "Join correctness", "Window-function correctness"],
        evidenceSignals: ["q1_q4_sql_set", "query sanity checks"],
        commonFailureModes: ["double counting", "incorrect running total logic"],
        scoreBands: { "1": "Weak", "3": "Moderate", "5": "Strong" },
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
      { event_type: "session_started", payload: { time_to_first_action_ms: 710 } },
      { event_type: "sql_query_run", payload: { row_count: 2, runtime_ms: 41 } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 36 } },
      { event_type: "python_code_run", payload: { runtime_ms: 58, has_plot: false } },
      { event_type: "python_code_run", payload: { runtime_ms: 64, has_plot: true } },
      { event_type: "dashboard_action", payload: { action: "annotate" } },
      { event_type: "dashboard_action", payload: { action: "set_filter" } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "outlier_check" } },
      { event_type: "verification_step_completed", payload: { step: "roi_sanity_check" } },
    ],
    mockScoreResult: {
      confidence: 0.89,
      dimensionScores: {
        problem_framing: 0.91,
        analysis_correctness: 0.88,
        recommendation_quality: 0.87,
        tradeoff_roi_rigor: 0.9,
        communication_story: 0.86,
        sql_proficiency: 0.86,
      },
      triggerCodes: ["pilot_design_rigorous", "roi_tradeoff_quantified", "fixture_program_4week"],
    },
    evaluationBundle: buildEvaluationBundle(
      [
        { dimension: "JD coverage", score: 95, note: "Matches analyst take-home + live deep-dive competencies." },
        { dimension: "Task realism", score: 94, note: "Case flow mirrors real marketplace strategy interviews." },
        { dimension: "Rubric depth", score: 93, note: "Six-dimension scorecard is evidence-linked and decision-oriented." },
        { dimension: "Difficulty progression", score: 96, note: "Four-week ladder from framing to live defense is explicit." },
      ],
      [
        { round: "Week 1", score: 89, note: "Metric framing and QA discipline established early." },
        { round: "Week 2", score: 87, note: "Root-cause and SQL execution are mostly robust." },
        { round: "Week 3", score: 90, note: "Pilot and ROI trade-off framing is strong." },
        { round: "Week 4", score: 88, note: "Executive narrative is concise and defensible." },
      ],
      [
        { tool: "sql", score: 88 },
        { tool: "python", score: 85 },
        { tool: "r", score: 0 },
        { tool: "dashboard", score: 86 },
      ],
      [
        { code: "pilot_design_rigorous", rationale: "Defined treatment/control and measurable guardrails.", impact: "positive" },
        { code: "roi_tradeoff_quantified", rationale: "Compared shared-team vs dedicated support on economics.", impact: "positive" },
        { code: "fixture_program_4week", rationale: "Completed full week-by-week progression under deterministic fixture.", impact: "positive" },
      ],
      [
        "Agent evaluator observed clear progression from diagnostics to decision-ready recommendation.",
        "Most residual risk came from assumptions around post-credit retention persistence.",
      ],
    ),
  },
}
