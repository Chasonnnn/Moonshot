import "server-only"

import {
  type ApiErrorShape,
  type AuthTokenResponse,
  type CaseSpec,
  type FairnessSmokeRun,
  type JobAccepted,
  type JobResultResponse,
  type MetaVersion,
  MoonshotApiError,
  type MoonshotRole,
  type RedTeamRun,
  type ReportSummary,
  type SessionRecord,
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

  async listJobs(token: string, limit = 20): Promise<{ items: Array<{ job_id: string; status: string; job_type?: string }> }> {
    return this.request<{ items: Array<{ job_id: string; status: string; job_type?: string }> }>(
      `/v1/jobs?limit=${limit}`,
      { token },
    )
  }

  async listSessions(token: string): Promise<{ items: SessionRecord[] }> {
    return this.request<{ items: SessionRecord[] }>("/v1/sessions", { token })
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
    filters?: { targetType?: string; targetId?: string },
  ): Promise<{ items: RedTeamRun[] }> {
    const params = new URLSearchParams()
    if (filters?.targetType) {
      params.set("target_type", filters.targetType)
    }
    if (filters?.targetId) {
      params.set("target_id", filters.targetId)
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
