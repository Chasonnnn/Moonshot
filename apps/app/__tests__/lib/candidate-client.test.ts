import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock csrf module
vi.mock("@/lib/moonshot/csrf", () => ({
  getCsrfToken: vi.fn(() => "mock-csrf-token"),
}))

import { CandidateApiClient, CandidateApiError } from "@/lib/moonshot/candidate-client"

describe("CandidateApiClient", () => {
  let client: CandidateApiClient
  const sessionId = "test-session-123"

  beforeEach(() => {
    client = new CandidateApiClient(sessionId)
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetchResponse(body: unknown, status = 200) {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  }

  function mockFetchError(status: number, body: { detail?: string; error_code?: string } = {}) {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  }

  function lastFetchCall() {
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls
    return { url: calls[calls.length - 1][0] as string, init: calls[calls.length - 1][1] as RequestInit }
  }

  describe("URL construction", () => {
    it("routes GET requests through the proxy", async () => {
      mockFetchResponse({ items: [] })
      await client.getSqlHistory()
      expect(lastFetchCall().url).toBe("/api/candidate/test-session-123/sql/history")
    })

    it("routes POST requests through the proxy", async () => {
      mockFetchResponse({ ok: true, row_count: 0, columns: [], rows: [], runtime_ms: 10 })
      await client.runSql("SELECT 1")
      expect(lastFetchCall().url).toBe("/api/candidate/test-session-123/sql/run")
    })
  })

  describe("CSRF token", () => {
    it("includes X-CSRF-Token header on POST requests", async () => {
      mockFetchResponse({ ok: true, row_count: 0, columns: [], rows: [], runtime_ms: 5 })
      await client.runSql("SELECT 1")
      const headers = lastFetchCall().init.headers as Record<string, string>
      expect(headers["X-CSRF-Token"]).toBe("mock-csrf-token")
    })

    it("does not include X-CSRF-Token on GET requests", async () => {
      mockFetchResponse({ items: [] })
      await client.getSqlHistory()
      const headers = lastFetchCall().init.headers as Record<string, string>
      expect(headers["X-CSRF-Token"]).toBeUndefined()
    })

    it("includes X-CSRF-Token header on PUT requests", async () => {
      mockFetchResponse({
        id: "d1",
        session_id: sessionId,
        part_id: null,
        content_markdown: "# v2",
        embedded_artifacts: [],
        status: "draft",
        created_at: "2026-03-05T00:00:00Z",
        updated_at: "2026-03-05T00:00:00Z",
      })
      await client.updateDeliverable("d1", "# v2")
      const headers = lastFetchCall().init.headers as Record<string, string>
      expect(headers["X-CSRF-Token"]).toBe("mock-csrf-token")
    })
  })

  describe("Idempotency-Key", () => {
    it("includes Idempotency-Key on event ingest", async () => {
      mockFetchResponse({ accepted: 1 })
      await client.ingestEvents([{ event_type: "test", payload: {} }])
      const headers = lastFetchCall().init.headers as Record<string, string>
      expect(headers["Idempotency-Key"]).toBeDefined()
      expect(headers["Idempotency-Key"].length).toBeGreaterThan(0)
    })
  })

  describe("error handling", () => {
    it("throws CandidateApiError on 400", async () => {
      mockFetchError(400, { detail: "Bad request", error_code: "bad_request" })
      await expect(client.runSql("bad")).rejects.toThrow(CandidateApiError)
    })

    it("throws CandidateApiError on 401 with correct status", async () => {
      mockFetchError(401, { detail: "Unauthorized" })
      try {
        await client.getSqlHistory()
      } catch (e) {
        expect(e).toBeInstanceOf(CandidateApiError)
        expect((e as CandidateApiError).status).toBe(401)
      }
    })

    it("throws CandidateApiError on 403", async () => {
      mockFetchError(403, { detail: "CSRF mismatch" })
      await expect(client.runSql("SELECT 1")).rejects.toThrow(CandidateApiError)
    })

    it("throws CandidateApiError on 500", async () => {
      mockFetchError(500)
      await expect(client.getSqlHistory()).rejects.toThrow(CandidateApiError)
    })
  })

  describe("coach rate limiting", () => {
    it("allows first message immediately", async () => {
      mockFetchResponse({ allowed: true, response: "hi", policy_reason: "ok", policy_decision_code: null, policy_version: null, policy_hash: null, blocked_rule_id: null })
      const result = await client.coachMessage("hello")
      expect(result.response).toBe("hi")
    })

    it("enforces 2s cooldown between coach messages", async () => {
      vi.useFakeTimers()
      mockFetchResponse({ allowed: true, response: "1", policy_reason: "ok", policy_decision_code: null, policy_version: null, policy_hash: null, blocked_rule_id: null })
      await client.coachMessage("first")

      mockFetchResponse({ allowed: true, response: "2", policy_reason: "ok", policy_decision_code: null, policy_version: null, policy_hash: null, blocked_rule_id: null })
      const secondPromise = client.coachMessage("second")

      // Second message should be delayed
      vi.advanceTimersByTime(2000)
      const result = await secondPromise
      expect(result.response).toBe("2")
      vi.useRealTimers()
    })
  })

  describe("method mapping", () => {
    it("runSql sends POST to sql/run", async () => {
      mockFetchResponse({ ok: true, row_count: 1, columns: ["a"], rows: [{ a: 1 }], runtime_ms: 5 })
      await client.runSql("SELECT 1")
      const { url, init } = lastFetchCall()
      expect(url).toBe("/api/candidate/test-session-123/sql/run")
      expect(init.method).toBe("POST")
      expect(JSON.parse(init.body as string)).toEqual({ query: "SELECT 1" })
    })

    it("getSqlHistory sends GET to sql/history", async () => {
      mockFetchResponse({ items: [] })
      await client.getSqlHistory()
      const { url, init } = lastFetchCall()
      expect(url).toBe("/api/candidate/test-session-123/sql/history")
      expect(init.method).toBe("GET")
    })

    it("getDashboardState sends GET to dashboard/state", async () => {
      mockFetchResponse({ filters: {}, view: "default", annotations: [] })
      await client.getDashboardState()
      expect(lastFetchCall().url).toBe("/api/candidate/test-session-123/dashboard/state")
    })

    it("dashboardAction sends POST to dashboard/action", async () => {
      mockFetchResponse({ filters: {}, view: "default", annotations: ["note"] })
      await client.dashboardAction("annotate", { note: "test" })
      const { url, init } = lastFetchCall()
      expect(url).toBe("/api/candidate/test-session-123/dashboard/action")
      expect(JSON.parse(init.body as string)).toEqual({ action_type: "annotate", payload: { note: "test" } })
    })

    it("coachMessage sends POST to coach/message", async () => {
      mockFetchResponse({ allowed: true, response: "ok", policy_reason: "ok", policy_decision_code: null, policy_version: null, policy_hash: null, blocked_rule_id: null })
      await client.coachMessage("hello")
      expect(lastFetchCall().url).toBe("/api/candidate/test-session-123/coach/message")
      expect(JSON.parse(lastFetchCall().init.body as string)).toEqual({ message: "hello" })
    })

    it("coachFeedback sends POST to coach/feedback", async () => {
      mockFetchResponse({ id: "f1", session_id: sessionId, candidate_id: "c1", helpful: true, confusion_tags: [], notes: null, created_at: "2024-01-01" })
      await client.coachFeedback(true, [], "great")
      const body = JSON.parse(lastFetchCall().init.body as string)
      expect(body).toEqual({ helpful: true, confusion_tags: [], notes: "great" })
    })

    it("ingestEvents sends POST to events", async () => {
      mockFetchResponse({ accepted: 2 })
      await client.ingestEvents([
        { event_type: "click", payload: { x: 1 } },
        { event_type: "view", payload: {} },
      ])
      const body = JSON.parse(lastFetchCall().init.body as string)
      expect(body).toEqual({ events: [{ event_type: "click", payload: { x: 1 } }, { event_type: "view", payload: {} }] })
    })

    it("getDatasets sends GET to datasets", async () => {
      mockFetchResponse({ datasets: [] })
      await client.getDatasets()
      const { url, init } = lastFetchCall()
      expect(url).toBe("/api/candidate/test-session-123/datasets")
      expect(init.method).toBe("GET")
    })

    it("updateDeliverable sends PUT to deliverables/:id", async () => {
      mockFetchResponse({
        id: "d1",
        session_id: sessionId,
        part_id: null,
        content_markdown: "# v2",
        embedded_artifacts: ["a.png"],
        status: "draft",
        created_at: "2026-03-05T00:00:00Z",
        updated_at: "2026-03-05T00:00:00Z",
      })
      await client.updateDeliverable("d1", "# v2", ["a.png"])
      const { url, init } = lastFetchCall()
      expect(url).toBe("/api/candidate/test-session-123/deliverables/d1")
      expect(init.method).toBe("PUT")
      expect(JSON.parse(init.body as string)).toEqual({
        content_markdown: "# v2",
        embedded_artifacts: ["a.png"],
      })
    })
  })
})
