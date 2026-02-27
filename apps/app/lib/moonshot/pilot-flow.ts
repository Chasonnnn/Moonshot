export interface PilotFlowStep {
  name: string
  ok: boolean
  detail: string
  requestId: string | null
}

export interface PilotFlowState {
  status: "idle" | "success" | "error"
  startedAt: string | null
  completedAt: string | null
  tenantId: string | null
  caseId: string | null
  taskFamilyId: string | null
  sessionId: string | null
  exportRunId: string | null
  confidence: number | null
  steps: PilotFlowStep[]
  error: string | null
}

export interface PilotSnapshot {
  ok: boolean
  apiVersion: string | null
  schemaVersion: string | null
  caseCount: number
  jobCount: number
  error: string | null
}

export const initialPilotFlowState: PilotFlowState = {
  status: "idle",
  startedAt: null,
  completedAt: null,
  tenantId: null,
  caseId: null,
  taskFamilyId: null,
  sessionId: null,
  exportRunId: null,
  confidence: null,
  steps: [],
  error: null,
}
