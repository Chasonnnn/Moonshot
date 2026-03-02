export type MoonshotRole = "org_admin" | "reviewer" | "candidate"

export type SessionMode = "practice" | "assessment" | "assessment_no_ai" | "assessment_ai_assisted"

export interface AuthTokenResponse {
  access_token: string
  token_type: "bearer"
  expires_at: string
  kid: string
}

export interface JobAccepted {
  job_id: string
  status: string
  submitted_at: string
}

export interface JobStatus {
  job_id: string
  status: string
  job_type?: string | null
  target_type?: string | null
  target_id?: string | null
  progress: number
  current_step?: string | null
  error_code?: string | null
  error_detail?: string | null
  submitted_at: string
  started_at?: string | null
  completed_at?: string | null
  next_attempt_at?: string | null
  lease_owner?: string | null
  lease_expires_at?: string | null
  attempt_count: number
  max_attempts: number
  last_error_code?: string | null
}

export interface JobResultResponse {
  job_id: string
  status: string
  result: Record<string, unknown> & {
    failed_step?: string
    current_step?: string
  }
}

export interface CaseSpec {
  id: string
  tenant_id: string
  title: string
  scenario: string
  artifacts?: Array<Record<string, unknown>>
  metrics?: Array<Record<string, unknown>>
  allowed_tools?: string[]
  status: string
  version: string
  created_at?: string
  updated_at?: string
}

export interface TaskVariant {
  id: string
  prompt: string
}

export interface TaskFamily {
  id: string
  case_id: string
  rubric_id: string
  status: string
  version: string
  variants: TaskVariant[]
  generation_diagnostics?: Record<string, unknown>
}

export interface SessionRecord {
  id: string
  tenant_id: string
  task_family_id: string
  candidate_id: string
  status: string
  policy: Record<string, unknown> & {
    demo_template_id?: string
    sample_script_version?: string
  }
  final_response?: string | null
  created_at?: string
  updated_at?: string
}

export interface ReportSummary {
  session_id: string
  session_status: string
  report_available: boolean
  confidence: number | null
  needs_human_review: boolean | null
  trigger_codes: string[]
  trigger_count: number
  last_scored_at: string | null
  scoring_version_lock: {
    scorer_version: string
    rubric_version: string
    task_family_version: string
    model_hash: string
  } | null
}

export interface MetaVersion {
  api_version: string
  schema_version: string
}

export interface RedTeamRun {
  id: string
  tenant_id: string | null
  target_type: string
  target_id: string
  status: string
  created_by: string | null
  submitted_job_id: string | null
  request_id: string | null
  evidence_refs: Record<string, unknown>
  created_at: string
  findings: Array<Record<string, unknown>>
}

export interface FairnessSmokeRun {
  id: string
  tenant_id: string
  scope: string
  status: string
  created_by: string | null
  submitted_job_id: string | null
  request_id: string | null
  target_session_id: string | null
  evidence_refs: Record<string, unknown>
  summary: Record<string, unknown>
  created_at: string
}

export interface ReviewQueueItem {
  session_id: string
  tenant_id: string
  status: string
  reason: string
  created_by: string
  reviewer_note: string | null
  resolution: string | null
  created_at: string
  updated_at: string
}

export interface InterpretationView {
  view_id: string
  session_id: string
  created_at: string
  focus_dimensions: string[]
  include_sensitivity: boolean
  weight_overrides: Record<string, number>
  breakdown: Record<string, unknown>
  caveats: string[]
  scoring_version_lock: {
    scorer_version: string
    rubric_version: string
    task_family_version: string
    model_hash: string
  }
}

export interface AdminPolicy {
  tenant_id: string
  raw_content_default_opt_in: boolean
  default_retention_ttl_days: number
  max_retention_ttl_days: number
}

export interface AuditLogItem {
  id: string
  tenant_id: string
  actor_role: string
  action: string
  resource_type: string
  resource_id: string
  metadata: Record<string, unknown>
  prev_hash: string
  entry_hash: string
  created_at: string
}

export interface ApiErrorShape {
  detail?: string
  error_code?: string
  error_detail?: string
  request_id?: string
}

export class MoonshotApiError extends Error {
  status: number
  errorCode: string
  errorDetail: string
  requestId: string | null

  constructor(message: string, options: { status: number; errorCode: string; errorDetail: string; requestId?: string | null }) {
    super(message)
    this.name = "MoonshotApiError"
    this.status = options.status
    this.errorCode = options.errorCode
    this.errorDetail = options.errorDetail
    this.requestId = options.requestId ?? null
  }
}

export interface CandidateSession {
  id: string
  tenant_id: string
  task_family_id: string
  candidate_id: string
  status: string
  policy: {
    raw_content_opt_in: boolean
    retention_ttl_days: number
    time_limit_minutes: number | null
    coach_mode?: SessionMode
    demo_template_id?: string
    sample_script_version?: string
  }
  final_response: string | null
  created_at: string
  updated_at: string
  task_prompt: string
}

export interface SqlRunResponse {
  ok: boolean
  row_count: number
  columns: string[]
  rows: Record<string, unknown>[]
  runtime_ms: number
}

export interface SqlHistoryItem {
  query: string
  ok: boolean
  row_count: number | null
  columns: string[]
  error: string | null
  executed_at: string
}

export interface DashboardState {
  filters: Record<string, unknown>
  view: string
  annotations: string[]
}

export interface CoachResponse {
  allowed: boolean
  response: string
  policy_reason: string
  policy_decision_code: string | null
  policy_version: string | null
  policy_hash: string | null
  blocked_rule_id: string | null
}

export interface CoachFeedback {
  id: string
  session_id: string
  candidate_id: string
  helpful: boolean
  confusion_tags: string[]
  notes: string | null
  created_at: string
}

export interface SessionEvent {
  event_type: string
  payload: Record<string, unknown>
  timestamp: string
}

export interface SessionEventsListResponse {
  items: SessionEvent[]
  next_cursor: number | null
  limit: number
  total: number
}

export interface PythonRunResponse {
  ok: boolean
  stdout: string | null
  stderr: string | null
  plot_url: string | null
  runtime_ms: number
}

export interface PythonHistoryItem {
  code: string
  ok: boolean
  stdout: string | null
  stderr: string | null
  plot_url: string | null
  error: string | null
  runtime_ms: number
  executed_at: string
}

export interface RRunResponse {
  ok: boolean
  stdout: string | null
  stderr: string | null
  plot_url: string | null
  runtime_ms: number
  mock: true
}

export interface RHistoryItem {
  code: string
  ok: boolean
  stdout: string | null
  stderr: string | null
  plot_url: string | null
  error: string | null
  runtime_ms: number
  executed_at: string
}
