export type MoonshotRole = "org_admin" | "reviewer" | "candidate"

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

export interface JobResultResponse {
  job_id: string
  status: string
  result: Record<string, unknown>
}

export interface CaseSpec {
  id: string
  tenant_id: string
  title: string
  scenario: string
  status: string
  version: string
}

export interface SessionRecord {
  id: string
  tenant_id: string
  task_family_id: string
  candidate_id: string
  status: string
  policy: Record<string, unknown>
}

export interface ReportSummary {
  session_id: string
  session_status: string
  report_available: boolean
  confidence: number | null
  needs_human_review: boolean | null
  trigger_codes: string[]
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
