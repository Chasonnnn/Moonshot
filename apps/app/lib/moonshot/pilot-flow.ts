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

export type DemoSeedMode = "fixture" | "fresh" | "both"

export interface ScenarioSeedEntry {
  source: "fixture" | "fresh"
  scenarioId: string
  title: string
  caseId: string
}

export interface ScenarioSeedManifest {
  mode: DemoSeedMode
  generatedAt: string
  entries: ScenarioSeedEntry[]
}

export interface GovernanceBundleReference {
  generatedAt: string
  checks: string[]
}

export interface DemoRunState extends PilotFlowState {
  apiBaseUrl: string | null
  mode: DemoSeedMode
  redteamJobId: string | null
  redteamRunId: string | null
  redteamRequestId: string | null
  fairnessJobId: string | null
  fairnessRunId: string | null
  fairnessRequestId: string | null
  redteamFindings: number | null
  fairnessSampleSize: number | null
  seedManifest: ScenarioSeedManifest | null
  governanceBundle: GovernanceBundleReference | null
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

export const initialDemoRunState: DemoRunState = {
  ...initialPilotFlowState,
  apiBaseUrl: null,
  mode: "both",
  redteamJobId: null,
  redteamRunId: null,
  redteamRequestId: null,
  fairnessJobId: null,
  fairnessRunId: null,
  fairnessRequestId: null,
  redteamFindings: null,
  fairnessSampleSize: null,
  seedManifest: null,
  governanceBundle: null,
}
