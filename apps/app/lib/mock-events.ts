import type { SessionEvent } from "@/lib/moonshot/types"

// TODO: Replace with real GET /v1/sessions/{id}/events endpoint

export function getMockSessionEvents(sessionId: string): SessionEvent[] {
  // Use sessionId to generate a deterministic base timestamp
  const hash = Array.from(sessionId).reduce(
    (acc, ch) => acc + ch.charCodeAt(0),
    0
  )
  const baseHour = 9 + (hash % 6) // 9-14
  const baseDate = new Date(`2026-03-01T${String(baseHour).padStart(2, "0")}:00:00Z`)

  const offsets = [
    0,
    45,
    90,
    140,
    180,
    240,
    300,
    360,
    420,
    510,
    570,
    640,
    710,
    780,
    850,
    910,
    980,
    1040,
    1110,
    1200,
  ] // seconds from start

  const events: SessionEvent[] = [
    {
      event_type: "session_started",
      payload: { candidate_id: `cand_${sessionId.slice(-4)}` },
      timestamp: new Date(baseDate.getTime() + offsets[0] * 1000).toISOString(),
    },
    {
      event_type: "co_design_started",
      payload: { template_id: "tpl_jda_quality", coordinator: "codesign_agent" },
      timestamp: new Date(baseDate.getTime() + offsets[1] * 1000).toISOString(),
    },
    {
      event_type: "co_design_completed",
      payload: { rubric_dimensions: 4, variant_target: 12, rounds: 3 },
      timestamp: new Date(baseDate.getTime() + offsets[2] * 1000).toISOString(),
    },
    {
      event_type: "task_generation_completed",
      payload: { task_family_id: "tf_demo_fixture", generated_variants: 12, version: "fixture-v2" },
      timestamp: new Date(baseDate.getTime() + offsets[3] * 1000).toISOString(),
    },
    {
      event_type: "round_started",
      payload: { round: 1, objective: "SQL discrepancy triage" },
      timestamp: new Date(baseDate.getTime() + offsets[4] * 1000).toISOString(),
    },
    {
      event_type: "sql_query_run",
      payload: { round: 1, query: "SELECT order_id FROM warehouse_orders WHERE dashboard_count = 0", row_count: 255 },
      timestamp: new Date(baseDate.getTime() + offsets[5] * 1000).toISOString(),
    },
    {
      event_type: "verification_step_completed",
      payload: { round: 1, step: "count_reconciliation", passed: true },
      timestamp: new Date(baseDate.getTime() + offsets[6] * 1000).toISOString(),
    },
    {
      event_type: "round_completed",
      payload: { round: 1, score: 82 },
      timestamp: new Date(baseDate.getTime() + offsets[7] * 1000).toISOString(),
    },
    {
      event_type: "round_started",
      payload: { round: 2, objective: "Python + R analytical validation" },
      timestamp: new Date(baseDate.getTime() + offsets[8] * 1000).toISOString(),
    },
    {
      event_type: "python_run",
      payload: { round: 2, runtime_ms: 820, artifact: "cohort_retention.png" },
      timestamp: new Date(baseDate.getTime() + offsets[9] * 1000).toISOString(),
    },
    {
      event_type: "analysis_r_run",
      payload: { round: 2, runtime_ms: 670, artifact: "glm_summary.txt" },
      timestamp: new Date(baseDate.getTime() + offsets[10] * 1000).toISOString(),
    },
    {
      event_type: "copilot_invoked",
      payload: { round: 2, prompt_tokens: 113, completion_tokens: 254 },
      timestamp: new Date(baseDate.getTime() + offsets[11] * 1000).toISOString(),
    },
    {
      event_type: "round_completed",
      payload: { round: 2, score: 85 },
      timestamp: new Date(baseDate.getTime() + offsets[12] * 1000).toISOString(),
    },
    {
      event_type: "round_started",
      payload: { round: 3, objective: "Dashboard interpretation + recommendation" },
      timestamp: new Date(baseDate.getTime() + offsets[13] * 1000).toISOString(),
    },
    {
      event_type: "dashboard_action",
      payload: { round: 3, action: "filter_region_apac", insight_delta: "refund_rate +1.8pp" },
      timestamp: new Date(baseDate.getTime() + offsets[14] * 1000).toISOString(),
    },
    {
      event_type: "stakeholder_recommendation_submitted",
      payload: { round: 3, confidence: 0.82, escalation: "P2_data_quality_review" },
      timestamp: new Date(baseDate.getTime() + offsets[15] * 1000).toISOString(),
    },
    {
      event_type: "round_completed",
      payload: { round: 3, score: 89 },
      timestamp: new Date(baseDate.getTime() + offsets[16] * 1000).toISOString(),
    },
    {
      event_type: "tab_blur_detected",
      payload: { duration_ms: 4200 },
      timestamp: new Date(baseDate.getTime() + offsets[17] * 1000).toISOString(),
    },
    {
      event_type: "copy_paste_detected",
      payload: { char_count: 127, source: "external" },
      timestamp: new Date(baseDate.getTime() + offsets[18] * 1000).toISOString(),
    },
    {
      event_type: "session_submitted",
      payload: { final_response_length: 1246, total_rounds: 3 },
      timestamp: new Date(baseDate.getTime() + offsets[19] * 1000).toISOString(),
    },
  ]

  return events
}
