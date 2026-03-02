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

  const offsets = [0, 150, 300, 375, 480, 600, 720] // seconds from start

  const events: SessionEvent[] = [
    {
      event_type: "session_started",
      payload: { candidate_id: `cand_${sessionId.slice(-4)}` },
      timestamp: new Date(baseDate.getTime() + offsets[0] * 1000).toISOString(),
    },
    {
      event_type: "sql_query_run",
      payload: { query: "SELECT * FROM orders LIMIT 10", row_count: 10 },
      timestamp: new Date(baseDate.getTime() + offsets[1] * 1000).toISOString(),
    },
    {
      event_type: "copilot_invoked",
      payload: { prompt_tokens: 85, completion_tokens: 210 },
      timestamp: new Date(baseDate.getTime() + offsets[2] * 1000).toISOString(),
    },
    {
      event_type: "tab_blur_detected",
      payload: { duration_ms: 4200 },
      timestamp: new Date(baseDate.getTime() + offsets[3] * 1000).toISOString(),
    },
    {
      event_type: "copy_paste_detected",
      payload: { char_count: 127, source: "external" },
      timestamp: new Date(baseDate.getTime() + offsets[4] * 1000).toISOString(),
    },
    {
      event_type: "verification_step_completed",
      payload: { step: "schema_validation", passed: true },
      timestamp: new Date(baseDate.getTime() + offsets[5] * 1000).toISOString(),
    },
    {
      event_type: "session_submitted",
      payload: { final_response_length: 1024 },
      timestamp: new Date(baseDate.getTime() + offsets[6] * 1000).toISOString(),
    },
  ]

  return events
}
