import "server-only"

import {
  type AdminPolicy,
  type ApiErrorShape,
  type AuthTokenResponse,
  type CaseSpec,
  type FairnessSmokeRun,
  type InterpretationView,
  type JobStatus,
  type JobAccepted,
  type JobResultResponse,
  type MetaVersion,
  MoonshotApiError,
  type MoonshotRole,
  type RedTeamRun,
  type ReportSummary,
  type ReviewQueueItem,
  type SessionRecord,
  type TaskFamily,
  type AuditLogItem,
} from "@/lib/moonshot/types"

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value.trim()
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface MoonshotClientConfig {
  baseUrl: string
  bootstrapToken: string
  tenantId: string
  adminUserId: string
  reviewerUserId: string
  candidateUserId: string
}

export interface WaitForJobOptions {
  timeoutMs?: number
  initialIntervalMs?: number
  maxIntervalMs?: number
}

export class MoonshotApiClient {
  readonly config: MoonshotClientConfig

  constructor(config: MoonshotClientConfig) {
    this.config = config
  }

  private async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PATCH"
      token?: string
      body?: Record<string, unknown>
      idempotencyKey?: string
      headers?: Record<string, string>
    } = {},
  ): Promise<T> {
    const method = options.method ?? "GET"
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    }
    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    })

    if (!response.ok) {
      let payload: ApiErrorShape = {}
      try {
        payload = (await response.json()) as ApiErrorShape
      } catch {
        payload = {}
      }
      const detail = payload.error_detail ?? payload.detail ?? `Request failed (${response.status})`
      const errorCode = payload.error_code ?? "unknown_error"
      const requestId = payload.request_id ?? response.headers.get("x-request-id")
      throw new MoonshotApiError(`${errorCode}: ${detail}`, {
        status: response.status,
        errorCode,
        errorDetail: detail,
        requestId,
      })
    }

    return (await response.json()) as T
  }

  async issueToken(role: MoonshotRole, userId: string): Promise<AuthTokenResponse> {
    return this.request<AuthTokenResponse>("/v1/auth/token", {
      method: "POST",
      headers: { "X-Bootstrap-Token": this.config.bootstrapToken },
      body: {
        role,
        user_id: userId,
        tenant_id: this.config.tenantId,
        expires_in_seconds: 3600,
      },
    })
  }

  async getMetaVersion(): Promise<MetaVersion> {
    return this.request<MetaVersion>("/v1/meta/version")
  }

  async listCases(token: string): Promise<{ items: CaseSpec[] }> {
    return this.request<{ items: CaseSpec[] }>("/v1/cases", { token })
  }

  async getCase(token: string, caseId: string): Promise<CaseSpec> {
    return this.request<CaseSpec>(`/v1/cases/${caseId}`, { token })
  }

  async updateCase(token: string, caseId: string, payload: Record<string, unknown>): Promise<CaseSpec> {
    return this.request<CaseSpec>(`/v1/cases/${caseId}`, {
      method: "PATCH",
      token,
      body: payload,
    })
  }

  async listJobs(token: string, limit = 20): Promise<{ items: Array<{ job_id: string; status: string; job_type?: string }> }> {
    return this.request<{ items: Array<{ job_id: string; status: string; job_type?: string }> }>(
      `/v1/jobs?limit=${limit}`,
      { token },
    )
  }

  async listSessions(token: string): Promise<{ items: SessionRecord[] }> {
    return this.request<{ items: SessionRecord[] }>("/v1/sessions", { token })
  }

  async getSession(token: string, sessionId: string): Promise<SessionRecord> {
    return this.request<SessionRecord>(`/v1/sessions/${sessionId}`, { token })
  }

  async createCase(token: string, payload: Record<string, unknown>): Promise<CaseSpec> {
    return this.request<CaseSpec>("/v1/cases", {
      method: "POST",
      token,
      body: payload,
    })
  }

  async generateCase(token: string, caseId: string, idempotencyKey: string): Promise<JobAccepted> {
    return this.request<JobAccepted>(`/v1/cases/${caseId}/generate`, {
      method: "POST",
      token,
      idempotencyKey,
    })
  }

  async listTaskFamilies(token: string): Promise<{ items: TaskFamily[] }> {
    return this.request<{ items: TaskFamily[] }>("/v1/task-families", { token })
  }

  async getTaskFamily(token: string, taskFamilyId: string): Promise<TaskFamily> {
    return this.request<TaskFamily>(`/v1/task-families/${taskFamilyId}`, { token })
  }

  async reviewTaskFamily(token: string, taskFamilyId: string): Promise<void> {
    await this.request(`/v1/task-families/${taskFamilyId}/review`, {
      method: "POST",
      token,
      body: { decision: "approve", review_note: "approved in pilot integration run" },
    })
  }

  async publishTaskFamily(token: string, taskFamilyId: string): Promise<void> {
    await this.request(`/v1/task-families/${taskFamilyId}/publish`, {
      method: "POST",
      token,
      body: { approver_note: "published in pilot integration run" },
    })
  }

  async createSession(token: string, taskFamilyId: string, candidateId: string): Promise<SessionRecord> {
    return this.request<SessionRecord>("/v1/sessions", {
      method: "POST",
      token,
      body: {
        task_family_id: taskFamilyId,
        candidate_id: candidateId,
        policy: { raw_content_opt_in: false, retention_ttl_days: 30 },
      },
    })
  }

  async setSessionMode(token: string, sessionId: string, mode: "practice" | "assessment"): Promise<SessionRecord> {
    return this.request<SessionRecord>(`/v1/sessions/${sessionId}/mode`, {
      method: "POST",
      token,
      body: { mode },
    })
  }

  async listReviewQueue(token: string, includeResolved = false): Promise<{ items: ReviewQueueItem[] }> {
    const include = includeResolved ? "true" : "false"
    return this.request<{ items: ReviewQueueItem[] }>(`/v1/review-queue?include_resolved=${include}`, { token })
  }

  async getReviewQueueItem(token: string, sessionId: string): Promise<ReviewQueueItem> {
    return this.request<ReviewQueueItem>(`/v1/review-queue/${sessionId}`, { token })
  }

  async resolveReviewQueueItem(
    token: string,
    sessionId: string,
    payload: { decision: "approved" | "rejected"; reviewer_note?: string },
  ): Promise<ReviewQueueItem> {
    return this.request<ReviewQueueItem>(`/v1/review-queue/${sessionId}/resolve`, {
      method: "POST",
      token,
      body: payload,
    })
  }

  async ingestEvents(token: string, sessionId: string, events: Array<{ event_type: string; payload: Record<string, unknown> }>): Promise<void> {
    await this.request(`/v1/sessions/${sessionId}/events`, {
      method: "POST",
      token,
      body: { events },
    })
  }

  async coachMessage(token: string, sessionId: string, message: string): Promise<{ allowed: boolean; policy_reason: string; response: string }> {
    return this.request<{ allowed: boolean; policy_reason: string; response: string }>(
      `/v1/sessions/${sessionId}/coach/message`,
      {
        method: "POST",
        token,
        body: { message },
      },
    )
  }

  async submitSession(token: string, sessionId: string, finalResponse: string): Promise<SessionRecord> {
    return this.request<SessionRecord>(`/v1/sessions/${sessionId}/submit`, {
      method: "POST",
      token,
      body: { final_response: finalResponse },
    })
  }

  async scoreSession(token: string, sessionId: string, idempotencyKey: string): Promise<JobAccepted> {
    return this.request<JobAccepted>(`/v1/sessions/${sessionId}/score`, {
      method: "POST",
      token,
      idempotencyKey,
    })
  }

  async exportSession(token: string, sessionId: string, idempotencyKey: string): Promise<JobAccepted> {
    return this.request<JobAccepted>("/v1/exports", {
      method: "POST",
      token,
      idempotencyKey,
      body: { session_id: sessionId },
    })
  }

  async getJobResult(token: string, jobId: string): Promise<JobResultResponse> {
    return this.request<JobResultResponse>(`/v1/jobs/${jobId}/result`, { token })
  }

  async getJobStatus(token: string, jobId: string): Promise<JobStatus> {
    return this.request<JobStatus>(`/v1/jobs/${jobId}`, { token })
  }

  async waitForJobTerminalResult(token: string, jobId: string, options: WaitForJobOptions = {}): Promise<JobResultResponse> {
    const timeoutMs = options.timeoutMs ?? 90_000
    let intervalMs = options.initialIntervalMs ?? 750
    const maxIntervalMs = options.maxIntervalMs ?? 3_000
    const startedAt = Date.now()

    while (Date.now() - startedAt <= timeoutMs) {
      const result = await this.getJobResult(token, jobId)
      if (result.status === "completed" || result.status === "failed_permanent") {
        return result
      }
      await sleep(intervalMs)
      intervalMs = Math.min(maxIntervalMs, Math.ceil(intervalMs * 1.5))
    }

    throw new Error(`Timed out waiting for job ${jobId} after ${timeoutMs}ms`)
  }

  async getReportSummary(token: string, sessionId: string): Promise<ReportSummary> {
    return this.request<ReportSummary>(`/v1/reports/${sessionId}/summary`, { token })
  }

  async getReport(token: string, sessionId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/v1/reports/${sessionId}`, { token })
  }

  async createInterpretation(
    token: string,
    sessionId: string,
    payload: {
      focus_dimensions?: string[]
      include_sensitivity?: boolean
      weight_overrides?: Record<string, number>
    },
    idempotencyKey: string,
  ): Promise<JobAccepted> {
    return this.request<JobAccepted>(`/v1/reports/${sessionId}/interpret`, {
      method: "POST",
      token,
      idempotencyKey,
      body: payload,
    })
  }

  async getInterpretation(token: string, sessionId: string, viewId: string): Promise<InterpretationView> {
    return this.request<InterpretationView>(`/v1/reports/${sessionId}/interpretations/${viewId}`, { token })
  }

  async getExport(token: string, runId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/v1/exports/${runId}`, { token })
  }

  async createRedteamRun(
    token: string,
    payload: { targetType: "case" | "task_family" | "session"; targetId: string },
    idempotencyKey: string,
  ): Promise<JobAccepted> {
    return this.request<JobAccepted>("/v1/redteam/runs", {
      method: "POST",
      token,
      idempotencyKey,
      body: { target_type: payload.targetType, target_id: payload.targetId },
    })
  }

  async listRedteamRuns(
    token: string,
    filters?: { targetType?: string; targetId?: string; status?: string; limit?: number },
  ): Promise<{ items: RedTeamRun[] }> {
    const params = new URLSearchParams()
    if (filters?.targetType) {
      params.set("target_type", filters.targetType)
    }
    if (filters?.targetId) {
      params.set("target_id", filters.targetId)
    }
    if (filters?.status) {
      params.set("status", filters.status)
    }
    if (typeof filters?.limit === "number") {
      params.set("limit", String(filters.limit))
    }
    const query = params.toString()
    const path = query ? `/v1/redteam/runs?${query}` : "/v1/redteam/runs"
    return this.request<{ items: RedTeamRun[] }>(path, { token })
  }

  async getRedteamRun(token: string, runId: string): Promise<RedTeamRun> {
    return this.request<RedTeamRun>(`/v1/redteam/runs/${runId}`, { token })
  }

  async createFairnessSmokeRun(
    token: string,
    payload: { scope: string; includeLanguageProxy?: boolean },
    idempotencyKey: string,
  ): Promise<JobAccepted> {
    return this.request<JobAccepted>("/v1/fairness/smoke-runs", {
      method: "POST",
      token,
      idempotencyKey,
      body: {
        scope: payload.scope,
        include_language_proxy: payload.includeLanguageProxy ?? true,
      },
    })
  }

  async getFairnessSmokeRun(token: string, runId: string): Promise<FairnessSmokeRun> {
    return this.request<FairnessSmokeRun>(`/v1/fairness/smoke-runs/${runId}`, { token })
  }

  async listFairnessSmokeRuns(
    token: string,
    filters?: { scope?: string; status?: string; targetSessionId?: string; limit?: number },
  ): Promise<{ items: FairnessSmokeRun[] }> {
    const params = new URLSearchParams()
    if (filters?.scope) {
      params.set("scope", filters.scope)
    }
    if (filters?.status) {
      params.set("status", filters.status)
    }
    if (filters?.targetSessionId) {
      params.set("target_session_id", filters.targetSessionId)
    }
    if (typeof filters?.limit === "number") {
      params.set("limit", String(filters.limit))
    }
    const query = params.toString()
    const path = query ? `/v1/fairness/smoke-runs?${query}` : "/v1/fairness/smoke-runs"
    return this.request<{ items: FairnessSmokeRun[] }>(path, { token })
  }

  async getAuditChainVerification(token: string): Promise<{
    valid: boolean
    checked_entries: number
    error_code?: string | null
    error_detail?: string | null
  }> {
    return this.request<{
      valid: boolean
      checked_entries: number
      error_code?: string | null
      error_detail?: string | null
    }>("/v1/audit-logs/verify", { token })
  }

  async getContextInjectionTraces(token: string, sessionId: string): Promise<{ items: Array<Record<string, unknown>> }> {
    return this.request<{ items: Array<Record<string, unknown>> }>(`/v1/context/injection-traces/${sessionId}`, { token })
  }

  async purgeExpiredRawContentDryRun(token: string): Promise<{ purged_sessions: number; dry_run: boolean }> {
    return this.request<{ purged_sessions: number; dry_run: boolean }>("/v1/admin/policies/purge-expired", {
      method: "POST",
      token,
      body: { dry_run: true },
    })
  }

  async getAdminPolicy(token: string): Promise<AdminPolicy> {
    return this.request<AdminPolicy>("/v1/admin/policies", { token })
  }

  async listAuditLogs(
    token: string,
    filters?: { action?: string; resourceType?: string },
  ): Promise<{ items: AuditLogItem[] }> {
    const params = new URLSearchParams()
    if (filters?.action) {
      params.set("action", filters.action)
    }
    if (filters?.resourceType) {
      params.set("resource_type", filters.resourceType)
    }
    const query = params.toString()
    const path = query ? `/v1/audit-logs?${query}` : "/v1/audit-logs"
    return this.request<{ items: AuditLogItem[] }>(path, { token })
  }
}

export function createMoonshotClientFromEnv(): MoonshotApiClient {
  const config: MoonshotClientConfig = {
    baseUrl: normalizeBaseUrl(requiredEnv("MOONSHOT_API_BASE_URL")),
    bootstrapToken: requiredEnv("MOONSHOT_BOOTSTRAP_TOKEN"),
    tenantId: requiredEnv("MOONSHOT_DEV_TENANT_ID"),
    adminUserId: requiredEnv("MOONSHOT_DEV_ADMIN_USER_ID"),
    reviewerUserId: requiredEnv("MOONSHOT_DEV_REVIEWER_USER_ID"),
    candidateUserId: requiredEnv("MOONSHOT_DEV_CANDIDATE_USER_ID"),
  }
  return new MoonshotApiClient(config)
}
