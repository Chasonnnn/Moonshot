import type { DemoStageDiagnostic } from "@/actions/pilot"

export function getStageDiagnosticKey(diagnostic: DemoStageDiagnostic): string {
  if (diagnostic.request_id) {
    return `request:${diagnostic.request_id}`
  }

  return [
    diagnostic.stage,
    diagnostic.status,
    diagnostic.job_id ?? "none",
    diagnostic.model ?? "none",
    diagnostic.detail,
    String(diagnostic.latency_ms),
  ].join("|")
}
