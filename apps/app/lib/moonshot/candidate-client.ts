import { getCsrfToken } from "@/lib/moonshot/csrf"
import type {
  SqlRunResponse,
  SqlHistoryItem,
  PythonRunResponse,
  PythonHistoryItem,
  DashboardState,
  CoachResponse,
  CoachFeedback,
} from "@/lib/moonshot/types"

export class CandidateApiError extends Error {
  status: number
  errorCode: string

  constructor(message: string, status: number, errorCode: string) {
    super(message)
    this.name = "CandidateApiError"
    this.status = status
    this.errorCode = errorCode
  }
}

export class CandidateApiClient {
  private sessionId: string
  private lastCoachMessageAt = 0
  private static COACH_COOLDOWN_MS = 2000

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  private baseUrl(path: string): string {
    return `/api/candidate/${this.sessionId}/${path}`
  }

  private async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST"
      body?: unknown
      idempotencyKey?: boolean
    } = {}
  ): Promise<T> {
    const method = options.method ?? "GET"
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (method === "POST") {
      const csrf = getCsrfToken()
      if (csrf) {
        headers["X-CSRF-Token"] = csrf
      }
    }

    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = crypto.randomUUID()
    }

    const response = await fetch(this.baseUrl(path), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      let payload: { detail?: string; error_code?: string } = {}
      try {
        payload = await response.json()
      } catch {
        // ignore parse errors
      }
      throw new CandidateApiError(
        payload.detail ?? `Request failed (${response.status})`,
        response.status,
        payload.error_code ?? "unknown_error"
      )
    }

    return (await response.json()) as T
  }

  async runSql(query: string): Promise<SqlRunResponse> {
    return this.request<SqlRunResponse>("sql/run", {
      method: "POST",
      body: { query },
    })
  }

  async getSqlHistory(): Promise<{ items: SqlHistoryItem[] }> {
    return this.request<{ items: SqlHistoryItem[] }>("sql/history")
  }

  async getDashboardState(): Promise<DashboardState> {
    return this.request<DashboardState>("dashboard/state")
  }

  async dashboardAction(
    actionType: string,
    payload: Record<string, unknown>
  ): Promise<DashboardState> {
    return this.request<DashboardState>("dashboard/action", {
      method: "POST",
      body: { action_type: actionType, payload },
    })
  }

  async coachMessage(message: string): Promise<CoachResponse> {
    const now = Date.now()
    const elapsed = now - this.lastCoachMessageAt
    if (elapsed < CandidateApiClient.COACH_COOLDOWN_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, CandidateApiClient.COACH_COOLDOWN_MS - elapsed)
      )
    }
    this.lastCoachMessageAt = Date.now()
    return this.request<CoachResponse>("coach/message", {
      method: "POST",
      body: { message },
    })
  }

  async coachFeedback(
    helpful: boolean,
    confusionTags: string[],
    notes?: string
  ): Promise<CoachFeedback> {
    return this.request<CoachFeedback>("coach/feedback", {
      method: "POST",
      body: { helpful, confusion_tags: confusionTags, notes: notes ?? null },
    })
  }

  async runPython(
    code: string,
    runtimeContext?: { template_id?: string; round_id?: string; dataset_id?: string },
  ): Promise<PythonRunResponse> {
    return this.request<PythonRunResponse>("python/run", {
      method: "POST",
      body: {
        code,
        ...(runtimeContext ?? {}),
      },
    })
  }

  async getPythonHistory(): Promise<{ items: PythonHistoryItem[] }> {
    return this.request<{ items: PythonHistoryItem[] }>("python/history")
  }

  async ingestEvents(
    events: Array<{ event_type: string; payload: Record<string, unknown> }>
  ): Promise<{ accepted: number }> {
    return this.request<{ accepted: number }>("events", {
      method: "POST",
      body: { events },
      idempotencyKey: true,
    })
  }
}
