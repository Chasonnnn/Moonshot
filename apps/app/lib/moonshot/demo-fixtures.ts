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

export interface DemoFixtureData {
  taskPrompt: string
  rubric: Array<{ key: string; anchor: string }>
  sqlQueries: DemoSqlQuery[]
  pythonScripts: DemoPythonScript[]
  coachScript: DemoCoachTurn[]
  finalResponse: string
  sampleEvents: DemoEventEntry[]
  mockScoreResult: DemoMockScoreResult
}

export const DEMO_FIXTURES: Record<string, DemoFixtureData> = {
  tpl_data_analyst: {
    taskPrompt:
      "Your company's weekly conversion rate dropped 18% last week. Using the provided funnel data, identify the root cause, validate your hypothesis with at least two queries, and propose next actions with uncertainty caveats.",
    rubric: [
      { key: "analytical_depth", anchor: "Identifies root cause with supporting evidence from multiple data points" },
      { key: "sql_proficiency", anchor: "Writes correct, efficient queries that address the investigation" },
      { key: "communication", anchor: "Explains findings clearly with appropriate uncertainty caveats" },
      { key: "verification", anchor: "Cross-checks results before drawing conclusions" },
    ],
    sqlQueries: [
      {
        query: "SELECT week, stage, conversion_rate FROM funnel_weekly ORDER BY week DESC LIMIT 10;",
        columns: ["week", "stage", "conversion_rate"],
        rows: [
          { week: "2026-02-23", stage: "signup_to_activation", conversion_rate: 0.34 },
          { week: "2026-02-23", stage: "activation_to_purchase", conversion_rate: 0.42 },
          { week: "2026-02-16", stage: "signup_to_activation", conversion_rate: 0.41 },
          { week: "2026-02-16", stage: "activation_to_purchase", conversion_rate: 0.51 },
          { week: "2026-02-09", stage: "signup_to_activation", conversion_rate: 0.40 },
        ],
      },
      {
        query: "SELECT channel, COUNT(*) as signups, AVG(conversion_rate) as avg_conv FROM funnel_weekly WHERE week = '2026-02-23' GROUP BY channel;",
        columns: ["channel", "signups", "avg_conv"],
        rows: [
          { channel: "organic", signups: 1240, avg_conv: 0.38 },
          { channel: "paid_social", signups: 3100, avg_conv: 0.22 },
          { channel: "email", signups: 890, avg_conv: 0.51 },
        ],
      },
      {
        query: "SELECT week, channel, conversion_rate FROM funnel_weekly WHERE channel = 'paid_social' ORDER BY week DESC LIMIT 5;",
        columns: ["week", "channel", "conversion_rate"],
        rows: [
          { week: "2026-02-23", channel: "paid_social", conversion_rate: 0.22 },
          { week: "2026-02-16", channel: "paid_social", conversion_rate: 0.45 },
          { week: "2026-02-09", channel: "paid_social", conversion_rate: 0.44 },
        ],
      },
    ],
    pythonScripts: [
      {
        code: 'import pandas as pd\n\ndf = pd.DataFrame({\n    "week": ["02-09", "02-16", "02-23"],\n    "organic": [0.39, 0.41, 0.38],\n    "paid_social": [0.44, 0.45, 0.22],\n    "email": [0.50, 0.52, 0.51]\n})\nprint(df.describe())',
        stdout:
          "       organic  paid_social     email\ncount  3.000000     3.000000  3.000000\nmean   0.393333     0.370000  0.510000\nstd    0.015275     0.130128  0.010000\nmin    0.380000     0.220000  0.500000\n25%    0.385000     0.330000  0.505000\n50%    0.390000     0.440000  0.510000\n75%    0.400000     0.445000  0.515000\nmax    0.410000     0.450000  0.520000",
      },
      {
        code: 'import matplotlib.pyplot as plt\n\nweeks = ["02-09", "02-16", "02-23"]\npaid = [0.44, 0.45, 0.22]\norganic = [0.39, 0.41, 0.38]\n\nplt.plot(weeks, paid, marker="o", label="Paid Social")\nplt.plot(weeks, organic, marker="s", label="Organic")\nplt.ylabel("Conversion Rate")\nplt.title("Channel Conversion Trend")\nplt.legend()\nplt.show()',
        stdout: "",
        plotUrl: "/mock/channel_trend.png",
      },
    ],
    coachScript: [
      { role: "user", content: "Where should I start investigating the conversion drop?", allowed: true },
      {
        role: "coach",
        content:
          "Good question. Start by segmenting the funnel data by stage and channel to isolate where the drop is most pronounced. Look for changes in volume vs. rate.",
        allowed: true,
      },
      { role: "user", content: "I see paid social dropped a lot. Should I just say that's the cause?", allowed: true },
      {
        role: "coach",
        content:
          "You're on the right track, but be careful about jumping to conclusions. Can you verify with a second data source or time comparison? Also consider whether the volume change could explain the rate change.",
        allowed: true,
      },
      {
        role: "user",
        content: "Can you write the SQL query for me?",
        allowed: false,
        policyReason: "Direct answer requests are not allowed in assessment mode. Try breaking down what you need to query.",
      },
    ],
    finalResponse:
      "The 18% conversion drop is primarily driven by a 51% decline in the paid_social channel (0.45 → 0.22). Organic and email channels remained stable within normal variance (< 3pp change). This suggests a channel-specific issue rather than a product-wide problem.\n\nKey evidence:\n1. Segmented analysis shows paid_social signups increased 2.5x while conversion halved — consistent with lower-quality traffic acquisition\n2. Time-series comparison confirms the drop is isolated to the most recent week\n3. Cross-channel comparison rules out platform-wide issues\n\nRecommended actions:\n- Audit paid social campaign targeting changes from the past week\n- Check for landing page or attribution changes affecting this channel\n- Monitor for one more week before concluding (n=1 week is limited)\n\nCaveats: This analysis is based on aggregate weekly data. Individual campaign-level data could reveal more nuance. The volume increase may indicate an intentional broader targeting strategy whose ROI should be evaluated over a longer window.",
    sampleEvents: [
      { event_type: "session_started", payload: { time_to_first_action_ms: 1200 } },
      { event_type: "sql_query_run", payload: { row_count: 5, runtime_ms: 42 } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 38 } },
      { event_type: "python_code_run", payload: { runtime_ms: 45, has_plot: false } },
      { event_type: "python_code_run", payload: { runtime_ms: 52, has_plot: true } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "cross_channel_check" } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 35 } },
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
  },

  tpl_jda_quality: {
    taskPrompt:
      "The orders dashboard shows 12,847 rows but the source CSV has 13,102. Find the discrepancy, determine if it's a data quality issue or ETL bug, and document your findings before the stakeholder meeting in 2 hours.",
    rubric: [
      { key: "data_quality_process", anchor: "Follows systematic process to identify missing/duplicate records" },
      { key: "sql_accuracy", anchor: "Writes correct queries to compare source vs dashboard counts" },
      { key: "documentation", anchor: "Documents findings clearly with specific row references" },
      { key: "escalation_judgment", anchor: "Makes appropriate decisions about when to escalate vs self-resolve" },
    ],
    sqlQueries: [
      {
        query: "SELECT COUNT(*) as total_orders, COUNT(DISTINCT order_id) as unique_orders FROM orders;",
        columns: ["total_orders", "unique_orders"],
        rows: [{ total_orders: 12847, unique_orders: 12592 }],
      },
      {
        query: "SELECT order_id, COUNT(*) as cnt FROM orders GROUP BY order_id HAVING COUNT(*) > 1 LIMIT 5;",
        columns: ["order_id", "cnt"],
        rows: [
          { order_id: "ORD-8842", cnt: 2 },
          { order_id: "ORD-9103", cnt: 2 },
          { order_id: "ORD-9217", cnt: 2 },
        ],
      },
    ],
    pythonScripts: [
      {
        code: 'import pandas as pd\n\nsource_count = 13102\ndashboard_count = 12847\nduplicates = 255\nmissing = source_count - dashboard_count + duplicates\n\nprint(f"Source rows: {source_count}")\nprint(f"Dashboard rows: {dashboard_count}")\nprint(f"Duplicates found: {duplicates}")\nprint(f"Truly missing: {missing - duplicates}")\nprint(f"Net discrepancy explained: {duplicates + (missing - duplicates)} = {source_count - dashboard_count + duplicates}")',
        stdout:
          "Source rows: 13102\nDashboard rows: 12847\nDuplicates found: 255\nTruly missing: 255\nNet discrepancy explained: 510 = 510",
      },
    ],
    coachScript: [
      { role: "user", content: "How do I figure out which rows are missing?", allowed: true },
      {
        role: "coach",
        content:
          "Start by checking for duplicates in the dashboard data, then compare unique IDs against the source. A LEFT JOIN or NOT IN subquery can help identify missing records.",
        allowed: true,
      },
      { role: "user", content: "Should I tell the stakeholder about the duplicates?", allowed: true },
      {
        role: "coach",
        content:
          "Yes, but frame it constructively. Present the finding, its impact on the dashboard numbers, and whether it affects any metrics they rely on. Include what you've verified and what still needs investigation.",
        allowed: true,
      },
    ],
    finalResponse:
      "The 255-row discrepancy between source (13,102) and dashboard (12,847) has two root causes:\n\n1. 255 duplicate rows in the dashboard (same order_id appearing 2x) — likely an ETL deduplication bug\n2. 510 source rows not present in the dashboard — these appear to be orders with null customer_id that the ETL pipeline filters out\n\nImpact: The duplicate rows inflate order count by ~2% but don't affect revenue totals (same order_id). The missing rows are orphan orders that should be investigated.\n\nRecommendation: Flag the ETL deduplication issue as a P2 bug. The missing rows need a business decision on whether null-customer orders should be included.",
    sampleEvents: [
      { event_type: "session_started", payload: { time_to_first_action_ms: 800 } },
      { event_type: "sql_query_run", payload: { row_count: 1, runtime_ms: 28 } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 55 } },
      { event_type: "python_code_run", payload: { runtime_ms: 30, has_plot: false } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "duplicate_check" } },
    ],
    mockScoreResult: {
      confidence: 0.82,
      dimensionScores: {
        data_quality_process: 0.85,
        sql_accuracy: 0.80,
        documentation: 0.84,
        escalation_judgment: 0.78,
      },
      triggerCodes: ["systematic_investigation"],
    },
  },

  tpl_jda_ambiguity: {
    taskPrompt:
      'Your VP of Marketing sent this message: "Can you pull the numbers for last quarter? I need to see how we\'re doing." Respond with clarifying questions, state your assumptions, and outline what you would deliver.',
    rubric: [
      { key: "ambiguity_recognition", anchor: "Identifies key ambiguities in the request (which numbers, which quarter, what metric)" },
      { key: "assumption_documentation", anchor: "Explicitly states assumptions made and their justification" },
      { key: "communication_clarity", anchor: "Responds professionally with clear structure" },
      { key: "escalation_appropriateness", anchor: "Knows when to proceed vs ask for clarification" },
    ],
    sqlQueries: [
      {
        query: "SELECT metric_name, definition, data_source FROM metric_dictionary WHERE category = 'marketing' ORDER BY metric_name;",
        columns: ["metric_name", "definition", "data_source"],
        rows: [
          { metric_name: "CAC", definition: "Total marketing spend / new customers acquired", data_source: "finance_db" },
          { metric_name: "MQL_count", definition: "Marketing qualified leads per period", data_source: "crm" },
          { metric_name: "pipeline_value", definition: "Total value of open opportunities", data_source: "crm" },
        ],
      },
    ],
    pythonScripts: [],
    coachScript: [
      { role: "user", content: "The request is really vague. Should I just guess what they want?", allowed: true },
      {
        role: "coach",
        content:
          "Don't guess. Instead, identify the specific ambiguities and respond with targeted clarifying questions. Show that you've thought about what 'the numbers' could mean in context.",
        allowed: true,
      },
      { role: "user", content: "What if they get annoyed that I'm asking questions instead of just delivering?", allowed: true },
      {
        role: "coach",
        content:
          "Frame your response as proactive, not uncertain. Lead with what you can deliver immediately based on reasonable assumptions, then ask about specifics. This shows initiative while still getting clarity.",
        allowed: true,
      },
      {
        role: "user",
        content: "Can you draft the response for me?",
        allowed: false,
        policyReason: "Direct answer generation is not allowed in assessment mode. Consider what structure would make your response effective.",
      },
    ],
    finalResponse:
      "Hi [VP Marketing],\n\nHappy to pull this together. To make sure I get you exactly what you need, a few clarifying questions:\n\n1. **Which metrics?** I'm assuming you want the core marketing KPIs (CAC, MQL count, pipeline value). Should I also include channel-level breakdowns?\n2. **Which quarter?** I'll default to Q4 2025 (Oct-Dec). Let me know if you meant a different period.\n3. **Format?** I can do a quick summary table or a full dashboard view with trends.\n\n**What I'll deliver by default** (unless you redirect me):\n- Q4 2025 marketing KPI summary (CAC, MQLs, pipeline value)\n- QoQ comparison vs Q3 2025\n- Top-line channel breakdown\n\nI can have the summary table ready in 30 minutes. A full dashboard with trends would take ~2 hours.\n\nLet me know if this covers it or if you'd like me to adjust scope.",
    sampleEvents: [
      { event_type: "session_started", payload: { time_to_first_action_ms: 650 } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 22 } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "assumption_check" } },
    ],
    mockScoreResult: {
      confidence: 0.91,
      dimensionScores: {
        ambiguity_recognition: 0.95,
        assumption_documentation: 0.90,
        communication_clarity: 0.92,
        escalation_appropriateness: 0.88,
      },
      triggerCodes: ["strong_communication", "proactive_clarification"],
    },
  },
}
