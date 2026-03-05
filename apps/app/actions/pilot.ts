"use server"

import { randomUUID } from "node:crypto"

import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import {
  type DemoRunState,
  type DemoSeedMode,
  initialDemoRunState,
  type PilotFlowState,
  type PilotFlowStep,
  type PilotSnapshot,
  type ScenarioSeedEntry,
  type ScenarioSeedManifest,
} from "@/lib/moonshot/pilot-flow"
import { MoonshotApiError, type SessionMode, type SessionRecord } from "@/lib/moonshot/types"
import { DEMO_CASE_TEMPLATES, type DemoCaseTemplate } from "@/lib/moonshot/demo-case-templates"
import { DEMO_FIXTURES } from "@/lib/moonshot/demo-fixtures"

export interface DashboardSnapshot {
  activeCases: number
  awaitingReview: number
  inFlightJobs: number
  meanConfidence: number | null
  confidenceSampleSize: number
  error: string | null
  recentSessions: Array<{
    id: string
    status: string
    confidence: number | null
    needsHumanReview: boolean | null
    lastScoredAt: string | null
  }>
}

export type DemoExecutionMode = "fixture" | "live"

export interface DemoStageDiagnostic {
  stage: "worker_health" | "create_case" | "generate" | "publish" | "create_session" | "score" | "export"
  status: "ok" | "error"
  latency_ms: number
  detail: string
  job_id: string | null
  request_id: string | null
  model: string | null
}

export interface LiveCoDesignDifficultyLevel {
  level: string
  focus: string
  expectation: string
}

export interface LiveCoDesignPromptBundle {
  jobDescription: string
  sampleTasks: string[]
  rubricBlueprint: string[]
  difficultyLadder: LiveCoDesignDifficultyLevel[]
  agentNotes: string[]
}

function toStep(name: string, detail: string, requestId: string | null = null): PilotFlowStep {
  return { name, ok: true, detail, requestId }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof MoonshotApiError) {
    return `${error.errorCode}: ${error.errorDetail} (request_id=${error.requestId ?? "n/a"})`
  }
  if (error instanceof Error) {
    return error.message
  }
  return "Unknown error"
}

function parseAssessmentMode(formData: FormData | undefined): SessionMode {
  const raw = String(formData?.get("assessment_mode") ?? "").trim()
  if (raw === "practice" || raw === "assessment" || raw === "assessment_no_ai" || raw === "assessment_ai_assisted") {
    return raw
  }
  return initialDemoRunState.assessmentMode
}

type DemoIntent = "prepare" | "continue" | "finalize"

function parseDemoIntent(formData: FormData | undefined): DemoIntent {
  const raw = String(formData?.get("intent") ?? "").trim()
  if (raw === "prepare" || raw === "continue" || raw === "finalize") {
    return raw
  }
  return "prepare"
}

function parseTemplateId(formData: FormData | undefined): string {
  const raw = String(formData?.get("template_id") ?? "").trim()
  if (DEMO_CASE_TEMPLATES.some((tpl) => tpl.id === raw)) {
    return raw
  }
  return initialDemoRunState.selectedTemplateId ?? DEMO_CASE_TEMPLATES[0].id
}

const SAMPLE_FINAL_RESPONSE =
  "I would segment retention by cohort, validate source/dashboard parity, document assumptions, and escalate with confidence caveats."

const DEMO_FIXTURE_JOB_WAIT = {
  timeoutMs: 35_000,
  initialIntervalMs: 200,
  maxIntervalMs: 900,
} as const

const DEMO_LIVE_JOB_WAIT = {
  timeoutMs: 120_000,
  initialIntervalMs: 250,
  maxIntervalMs: 1_250,
} as const

const DEMO_LIVE_DEFAULT_MODEL = "anthropic/claude-opus-4-6"
const DEMO_LIVE_DEFAULT_REASONING_EFFORT = "high"
const DEMO_LIVE_DEFAULT_THINKING_BUDGET_TOKENS = 10_000
const LIVE_CO_DESIGN_SCHEMA_ID = "moonshot.demo.live_co_design.v1"
const LIVE_GENERATION_OUTPUT_SCHEMA_ID = "moonshot.demo.live_generation_output.v1"

function normalizeLiveModelOverride(modelOverride: string | null | undefined): string {
  const normalized = (modelOverride ?? "").trim()
  if (!normalized) {
    return DEMO_LIVE_DEFAULT_MODEL
  }
  return normalized
}

function normalizeLiveReasoningEffort(reasoningEffort: string | null | undefined): string {
  const normalized = (reasoningEffort ?? "").trim().toLowerCase()
  if (!normalized) {
    return DEMO_LIVE_DEFAULT_REASONING_EFFORT
  }
  if (normalized === "fast") {
    return "low"
  }
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "xhigh") {
    return normalized
  }
  return DEMO_LIVE_DEFAULT_REASONING_EFFORT
}

function normalizeLine(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

function normalizeLines(lines: string[]): string[] {
  return lines.map((line) => normalizeLine(line)).filter((line) => line.length > 0)
}

function normalizeLiveCoDesignBundle(
  bundle: LiveCoDesignPromptBundle | null | undefined,
): LiveCoDesignPromptBundle | null {
  if (!bundle) {
    return null
  }
  const jobDescription = normalizeLine(bundle.jobDescription)
  const sampleTasks = normalizeLines(bundle.sampleTasks)
  const rubricBlueprint = normalizeLines(bundle.rubricBlueprint)
  const difficultyLadder = bundle.difficultyLadder
    .map((level) => ({
      level: normalizeLine(level.level),
      focus: normalizeLine(level.focus),
      expectation: normalizeLine(level.expectation),
    }))
    .filter((level) => level.level && level.focus && level.expectation)
  const agentNotes = normalizeLines(bundle.agentNotes)
  if (!jobDescription || sampleTasks.length === 0 || rubricBlueprint.length === 0 || difficultyLadder.length === 0) {
    return null
  }
  return {
    jobDescription,
    sampleTasks,
    rubricBlueprint,
    difficultyLadder,
    agentNotes,
  }
}

function toBulletedMarkdown(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n")
}

function toDifficultyMarkdown(levels: LiveCoDesignDifficultyLevel[]): string {
  return levels
    .map((level) => `- ${level.level}: ${level.focus} | expectation: ${level.expectation}`)
    .join("\n")
}

function buildLiveScenario(template: DemoCaseTemplate, bundle: LiveCoDesignPromptBundle | null | undefined): string {
  const normalizedBundle = normalizeLiveCoDesignBundle(bundle)
  if (!normalizedBundle) {
    return template.scenario
  }
  return [
    template.scenario,
    "",
    `Live co-design schema: ${LIVE_CO_DESIGN_SCHEMA_ID}`,
    `Output contract schema: ${LIVE_GENERATION_OUTPUT_SCHEMA_ID}`,
    "",
    "Job Description:",
    normalizedBundle.jobDescription,
    "",
    "Sample Tasks:",
    toBulletedMarkdown(normalizedBundle.sampleTasks),
    "",
    "Rubric Blueprint:",
    toBulletedMarkdown(normalizedBundle.rubricBlueprint),
    "",
    "Designed Incremental Difficulty Levels:",
    toDifficultyMarkdown(normalizedBundle.difficultyLadder),
    "",
    "Agent Co-Design Notes:",
    toBulletedMarkdown(normalizedBundle.agentNotes),
    "",
    "Locked Output Contract:",
    "- variants[] fields: prompt, skill, difficulty_level, round_hint, estimated_minutes, deliverables[], artifact_refs[]",
    "- rubric.dimensions[] fields: key, anchor, evaluation_points[], evidence_signals[], common_failure_modes[], score_bands{}",
    "- keep response safe and simulation-only, no answer leakage",
  ].join("\n")
}

function buildCaseCreatePayload(
  template: DemoCaseTemplate,
  mode: DemoExecutionMode,
  liveCoDesignBundle: LiveCoDesignPromptBundle | null | undefined,
): Record<string, unknown> {
  return {
    title: `[Demo ${mode === "live" ? "Live" : "Fixture"}] ${template.title}`,
    scenario: mode === "live" ? buildLiveScenario(template, liveCoDesignBundle) : template.scenario,
    artifacts: template.artifacts,
    metrics: [],
    allowed_tools: ["sql_workspace", "python_workspace", "dashboard_workspace", "copilot"],
  }
}

function jobWaitForMode(mode: DemoExecutionMode) {
  return mode === "live" ? DEMO_LIVE_JOB_WAIT : DEMO_FIXTURE_JOB_WAIT
}

function stageStartedAt(): number {
  return Date.now()
}

function stageLatencyMs(startedAt: number): number {
  return Math.max(1, Date.now() - startedAt)
}

function inferFailureStage(diagnostics: DemoStageDiagnostic[]): DemoStageDiagnostic["stage"] {
  const has = (stage: DemoStageDiagnostic["stage"]) => diagnostics.some((item) => item.stage === stage)
  if (!has("worker_health")) return "worker_health"
  if (!has("create_case")) return "create_case"
  if (!has("generate")) return "generate"
  if (!has("publish")) return "publish"
  if (!has("create_session")) return "create_session"
  if (!has("score")) return "score"
  if (!has("export")) return "export"
  return "generate"
}

function appendFailureDiagnostic(
  diagnostics: DemoStageDiagnostic[],
  detail: string,
): DemoStageDiagnostic[] {
  const stage = inferFailureStage(diagnostics)
  const next = [...diagnostics]
  next.push({
    stage,
    status: "error",
    latency_ms: 0,
    detail,
    job_id: null,
    request_id: null,
    model: null,
  })
  return next
}

async function getWorkerReadinessError(
  client: ReturnType<typeof createMoonshotClientFromEnv>,
  adminToken: string,
): Promise<string | null> {
  const health = await client.getWorkersHealth(adminToken)
  const healthyWorkers = health.workers.filter((worker) => worker.status === "ok")
  if (healthyWorkers.length > 0) {
    return null
  }
  if (health.workers.length === 0) {
    return "No active worker detected. Start the worker service (`bash apps/api/scripts/start_worker.sh`) and retry."
  }
  return `Worker service is not healthy (overall=${health.overall_status}, stale_leases=${health.stale_leases}). Restart worker and retry.`
}

async function runCaseToReportExportFlow(args: {
  caseId: string
  adminToken: string
  reviewerToken: string
  candidateToken: string
  candidateUserId: string
  assessmentMode: SessionMode
  steps: PilotFlowStep[]
}) {
  const client = createMoonshotClientFromEnv()

  const generateJob = await client.generateCase(args.adminToken, args.caseId, `generate-${randomUUID()}`)
  args.steps.push(toStep("submit_generate_job", `Generation job submitted (${generateJob.job_id})`))

  const generated = await client.waitForJobTerminalResult(args.adminToken, generateJob.job_id)
  if (generated.status !== "completed") {
    throw new Error(`Generate job failed: ${JSON.stringify(generated.result)}`)
  }
  const taskFamily = generated.result["task_family"] as Record<string, unknown> | undefined
  const taskFamilyId = String(taskFamily?.["id"] ?? "")
  if (!taskFamilyId) {
    throw new Error("Generate result missing task_family.id")
  }
  args.steps.push(toStep("review_publish", `Task family generated (${taskFamilyId})`))

  await client.reviewTaskFamily(args.reviewerToken, taskFamilyId)
  await client.publishTaskFamily(args.reviewerToken, taskFamilyId)
  args.steps.push(toStep("review_publish", "Task family reviewed and published"))

  const session = await client.createSession(args.reviewerToken, taskFamilyId, args.candidateUserId)
  args.steps.push(toStep("create_session", `Session created (${session.id})`))

  await client.setSessionMode(args.reviewerToken, session.id, args.assessmentMode)
  await client.ingestEvents(args.candidateToken, session.id, [
    { event_type: "session_started", payload: { time_to_first_action_ms: 920 } },
    { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 44 } },
    { event_type: "copilot_invoked", payload: { source: "coach" } },
    { event_type: "verification_step_completed", payload: { step: "sanity_check" } },
  ])
  if (args.assessmentMode === "assessment_no_ai") {
    try {
      await client.coachMessage(
        args.candidateToken,
        session.id,
        "Can you clarify what validation evidence I should include before escalation?",
      )
      throw new Error("Expected coach API to be disabled for assessment_no_ai mode")
    } catch (error) {
      if (!(error instanceof MoonshotApiError) || error.errorCode !== "coach_disabled_for_mode") {
        throw error
      }
      args.steps.push(
        toStep(
          "candidate_handoff",
          `Coach API block verified for assessment_no_ai (request_id=${error.requestId ?? "n/a"})`,
          error.requestId,
        ),
      )
    }
  } else {
    await client.coachMessage(
      args.candidateToken,
      session.id,
      "Can you clarify what validation evidence I should include before escalation?",
    )
  }
  await client.submitSession(
    args.candidateToken,
    session.id,
    "I would segment retention by cohort and verify data quality before escalating with concrete caveats.",
  )
  args.steps.push(
    toStep("candidate_handoff", `Candidate session ready at /session/${session.id}/start (mode=${args.assessmentMode})`),
  )

  const scoreJob = await client.scoreSession(args.reviewerToken, session.id, `score-${randomUUID()}`)
  args.steps.push(toStep("score", `Score job submitted (${scoreJob.job_id})`))
  const scored = await client.waitForJobTerminalResult(args.reviewerToken, scoreJob.job_id)
  if (scored.status !== "completed") {
    throw new Error(`Score job failed: ${JSON.stringify(scored.result)}`)
  }

  const summary = await client.getReportSummary(args.reviewerToken, session.id)
  await client.getReport(args.reviewerToken, session.id)
  const exportJob = await client.exportSession(args.reviewerToken, session.id, `export-${randomUUID()}`)
  const exported = await client.waitForJobTerminalResult(args.reviewerToken, exportJob.job_id)
  if (exported.status !== "completed") {
    throw new Error(`Export job failed: ${JSON.stringify(exported.result)}`)
  }
  const exportRunId = String(exported.result["run_id"] ?? "")
  if (!exportRunId) {
    throw new Error("Export result missing run_id")
  }
  await client.getExport(args.reviewerToken, exportRunId)
  args.steps.push(toStep("report_export", `Report + export complete (run_id=${exportRunId})`))

  return {
    taskFamilyId,
    sessionId: session.id,
    exportRunId,
    confidence: summary.confidence,
  }
}

function summarizeSeedManifest(mode: DemoSeedMode, entries: ScenarioSeedEntry[]): ScenarioSeedManifest {
  return {
    mode,
    generatedAt: new Date().toISOString(),
    entries,
  }
}

export async function loadPilotSnapshot(): Promise<PilotSnapshot> {
  try {
    const client = createMoonshotClientFromEnv()
    const adminToken = await client.issueToken("org_admin", client.config.adminUserId)
    const [meta, cases, jobs] = await Promise.all([
      client.getMetaVersion(),
      client.listCases(adminToken.access_token),
      client.listJobs(adminToken.access_token, 100),
    ])
    const queuedJobs = jobs.items.filter((job) => ["pending", "running", "retrying"].includes(job.status)).length

    return {
      ok: true,
      apiVersion: meta.api_version,
      schemaVersion: meta.schema_version,
      caseCount: cases.items.length,
      jobCount: queuedJobs,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      apiVersion: null,
      schemaVersion: null,
      caseCount: 0,
      jobCount: 0,
      error: toErrorMessage(error),
    }
  }
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const client = createMoonshotClientFromEnv()
    const reviewerToken = await client.issueToken("reviewer", client.config.reviewerUserId)
    const [cases, sessions, jobs] = await Promise.all([
      client.listCases(reviewerToken.access_token),
      client.listSessions(reviewerToken.access_token),
      client.listJobs(reviewerToken.access_token, 100),
    ])

    const sortedSessions = [...sessions.items].sort((a: SessionRecord, b: SessionRecord) => {
      const aDate = Date.parse(a.created_at ?? "1970-01-01T00:00:00.000Z")
      const bDate = Date.parse(b.created_at ?? "1970-01-01T00:00:00.000Z")
      return bDate - aDate
    })
    const recentSessions = sortedSessions.slice(0, 10)
    const summaries = await Promise.all(
      recentSessions.map(async (session) => {
        try {
          return await client.getReportSummary(reviewerToken.access_token, session.id)
        } catch {
          return null
        }
      }),
    )

    const confidenceValues = summaries
      .filter((summary): summary is Exclude<typeof summary, null> => summary !== null && typeof summary.confidence === "number")
      .map((summary) => Number(summary.confidence))
    const meanConfidence = confidenceValues.length
      ? Number((confidenceValues.reduce((acc, value) => acc + value, 0) / confidenceValues.length).toFixed(3))
      : null

    const awaitingReviewCount = summaries.filter((summary) => summary?.needs_human_review === true).length
    const inFlightJobs = jobs.items.filter((job) => ["pending", "running", "retrying"].includes(job.status)).length
    const activeCases = cases.items.filter((item) => item.status !== "archived").length

    return {
      activeCases,
      awaitingReview: awaitingReviewCount,
      inFlightJobs,
      meanConfidence,
      confidenceSampleSize: confidenceValues.length,
      error: null,
      recentSessions: recentSessions.map((session, idx) => {
        const summary = summaries[idx]
        return {
          id: session.id,
          status: session.status,
          confidence: summary?.confidence ?? null,
          needsHumanReview: summary?.needs_human_review ?? null,
          lastScoredAt: summary?.last_scored_at ?? null,
        }
      }),
    }
  } catch (error) {
    return {
      activeCases: 0,
      awaitingReview: 0,
      inFlightJobs: 0,
      meanConfidence: null,
      confidenceSampleSize: 0,
      error: toErrorMessage(error),
      recentSessions: [],
    }
  }
}

export async function runJdaPilotFlow(_previous: PilotFlowState): Promise<PilotFlowState> {
  void _previous
  const startedAt = new Date().toISOString()
  const steps: PilotFlowStep[] = []
  let tenantId: string | null = null

  try {
    const client = createMoonshotClientFromEnv()
    tenantId = client.config.tenantId
    const adminToken = await client.issueToken("org_admin", client.config.adminUserId)
    steps.push(toStep("issue_admin_token", "Bootstrap org_admin token issued"))
    const reviewerToken = await client.issueToken("reviewer", client.config.reviewerUserId)
    steps.push(toStep("issue_reviewer_token", "Bootstrap reviewer token issued"))
    const candidateToken = await client.issueToken("candidate", client.config.candidateUserId)
    steps.push(toStep("issue_candidate_token", "Bootstrap candidate token issued"))

    const createdCase = await client.createCase(adminToken.access_token, {
      title: `JDA Integration Case ${new Date().toISOString()}`,
      scenario: "Investigate a retention drop by cohort and recommend actions with confidence caveats.",
      artifacts: [{ type: "csv", name: "retention_by_cohort.csv" }],
      metrics: [],
      allowed_tools: ["sql_workspace", "dashboard_workspace", "copilot"],
    })
    steps.push(toStep("create_case", `Case created (${createdCase.id})`))

    const flow = await runCaseToReportExportFlow({
      caseId: createdCase.id,
      adminToken: adminToken.access_token,
      reviewerToken: reviewerToken.access_token,
      candidateToken: candidateToken.access_token,
      candidateUserId: client.config.candidateUserId,
      assessmentMode: "assessment",
      steps,
    })

    return {
      status: "success",
      startedAt,
      completedAt: new Date().toISOString(),
      tenantId,
      caseId: createdCase.id,
      taskFamilyId: flow.taskFamilyId,
      sessionId: flow.sessionId,
      exportRunId: flow.exportRunId,
      confidence: flow.confidence,
      steps,
      error: null,
    }
  } catch (error) {
    steps.push({
      name: "flow_failed",
      ok: false,
      detail: toErrorMessage(error),
      requestId: error instanceof MoonshotApiError ? error.requestId : null,
    })
    return {
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
      tenantId,
      caseId: null,
      taskFamilyId: null,
      sessionId: null,
      exportRunId: null,
      confidence: null,
      steps,
      error: toErrorMessage(error),
    }
  }
}

export async function runJdaDemoFlow(previous: DemoRunState, formData: FormData): Promise<DemoRunState> {
  const startedAt = previous.startedAt ?? new Date().toISOString()
  const intent = parseDemoIntent(formData)
  const assessmentMode = intent === "prepare" ? parseAssessmentMode(formData) : previous.assessmentMode
  const selectedTemplateId = intent === "prepare" ? parseTemplateId(formData) : (previous.selectedTemplateId ?? parseTemplateId(formData))
  const mode: DemoSeedMode = "fresh"
  const steps: PilotFlowStep[] = intent === "prepare" ? [] : [...previous.steps]
  const seedEntries: ScenarioSeedEntry[] = previous.seedManifest?.entries ?? []
  let tenantId: string | null = previous.tenantId
  let apiBaseUrl: string | null = previous.apiBaseUrl

  try {
    const client = createMoonshotClientFromEnv()
    tenantId = client.config.tenantId
    apiBaseUrl = client.config.baseUrl

    if (intent === "prepare") {
      const [adminToken, meta] = await Promise.all([
        client.issueToken("org_admin", client.config.adminUserId),
        client.getMetaVersion(),
      ])
      steps.push(toStep("health", `Connected to API ${meta.api_version}`))

      const template = DEMO_CASE_TEMPLATES.find((item) => item.id === selectedTemplateId)
      if (!template) {
        throw new Error(`Unknown demo template: ${selectedTemplateId}`)
      }

      const createdCase = await client.createCase(adminToken.access_token, {
        title: `[Template] ${template.title}`,
        scenario: template.scenario,
        artifacts: template.artifacts,
        metrics: [],
        allowed_tools: ["sql_workspace", "dashboard_workspace", "copilot"],
      })

      const generateJob = await client.generateCase(adminToken.access_token, createdCase.id, `demo-generate-${randomUUID()}`)
      steps.push(toStep("submit_generate_job", `Generation job submitted (${generateJob.job_id})`))
      const generated = await client.waitForJobTerminalResult(adminToken.access_token, generateJob.job_id)
      if (generated.status !== "completed") {
        throw new Error(`Generate job failed: ${JSON.stringify(generated.result)}`)
      }
      const taskFamily = generated.result["task_family"] as Record<string, unknown> | undefined
      const taskFamilyId = String(taskFamily?.["id"] ?? "")
      if (!taskFamilyId) {
        throw new Error("Generate result missing task_family.id")
      }

      steps.push(
        toStep(
          "seed_or_generate",
          `Template case created (${createdCase.id}) and task family generated (${taskFamilyId})`,
        ),
      )
      steps.push(
        toStep(
          "review_publish",
          `Manual approval required in /cases/${createdCase.id}. Approve + Publish task family before continuing.`,
        ),
      )

      return {
        ...initialDemoRunState,
        status: "success",
        phase: "awaiting_approval",
        mode,
        selectedTemplateId,
        assessmentMode,
        startedAt,
        completedAt: new Date().toISOString(),
        tenantId,
        apiBaseUrl,
        caseId: createdCase.id,
        taskFamilyId,
        steps,
        error: null,
        seedManifest: summarizeSeedManifest(mode, [
          {
            source: "fresh",
            scenarioId: template.id,
            title: template.title,
            caseId: createdCase.id,
          },
        ]),
      }
    }

    if (intent === "continue") {
      const [reviewerToken] = await Promise.all([
        client.issueToken("reviewer", client.config.reviewerUserId),
      ])

      const caseId = previous.caseId
      const taskFamilyId = previous.taskFamilyId
      if (!caseId || !taskFamilyId) {
        throw new Error("Prepare step is incomplete. Run Prepare Demo Case first.")
      }

      const taskFamily = await client.getTaskFamily(reviewerToken.access_token, taskFamilyId)
      if (taskFamily.status !== "published") {
        steps.push({
          name: "review_publish",
          ok: false,
          detail: `Task family is ${taskFamily.status}. Approve and publish in /cases/${caseId} before continuing.`,
          requestId: null,
        })
        return {
          ...previous,
          status: "error",
          phase: "awaiting_approval",
          completedAt: new Date().toISOString(),
          steps,
          error: `Task family must be published before session handoff (current=${taskFamily.status}).`,
        }
      }

      const session = await client.createSession(reviewerToken.access_token, taskFamilyId, client.config.candidateUserId)
      await client.setSessionMode(reviewerToken.access_token, session.id, assessmentMode)
      steps.push(toStep("create_session", `Session created (${session.id})`))
      steps.push(toStep("candidate_handoff", `Candidate session ready at /session/${session.id}/start`))

      return {
        ...previous,
        status: "success",
        phase: "session_ready",
        assessmentMode,
        completedAt: new Date().toISOString(),
        sessionId: session.id,
        steps,
        error: null,
      }
    }

    const sessionId = previous.sessionId
    const caseId = previous.caseId
    const taskFamilyId = previous.taskFamilyId
    if (!sessionId || !caseId || !taskFamilyId) {
      throw new Error("Session handoff is not ready. Run Continue After Manual Approval first.")
    }

    const [adminToken, reviewerToken, candidateToken] = await Promise.all([
      client.issueToken("org_admin", client.config.adminUserId),
      client.issueToken("reviewer", client.config.reviewerUserId),
      client.issueToken("candidate", client.config.candidateUserId),
    ])

    await client.ingestEvents(candidateToken.access_token, sessionId, [
      { event_type: "session_started", payload: { time_to_first_action_ms: 920 } },
      { event_type: "sql_query_run", payload: { row_count: 3, runtime_ms: 44 } },
      { event_type: "copilot_invoked", payload: { source: "coach" } },
      { event_type: "verification_step_completed", payload: { step: "sanity_check" } },
    ])

    if (assessmentMode === "assessment_no_ai") {
      try {
        await client.coachMessage(
          candidateToken.access_token,
          sessionId,
          "Can you clarify what validation evidence I should include before escalation?",
        )
        throw new Error("Expected coach API to be disabled for assessment_no_ai mode")
      } catch (error) {
        if (!(error instanceof MoonshotApiError) || error.errorCode !== "coach_disabled_for_mode") {
          throw error
        }
        steps.push(
          toStep(
            "candidate_handoff",
            `Coach API block verified for assessment_no_ai (request_id=${error.requestId ?? "n/a"})`,
            error.requestId,
          ),
        )
      }
    } else {
      await client.coachMessage(
        candidateToken.access_token,
        sessionId,
        "Can you clarify what validation evidence I should include before escalation?",
      )
    }

    await client.submitSession(candidateToken.access_token, sessionId, SAMPLE_FINAL_RESPONSE)
    steps.push(toStep("candidate_handoff", "Sample response submitted for demo completion"))

    const scoreJob = await client.scoreSession(reviewerToken.access_token, sessionId, `score-${randomUUID()}`)
    steps.push(toStep("score", `Score job submitted (${scoreJob.job_id})`))
    const scored = await client.waitForJobTerminalResult(reviewerToken.access_token, scoreJob.job_id)
    if (scored.status !== "completed") {
      throw new Error(`Score job failed: ${JSON.stringify(scored.result)}`)
    }

    const summary = await client.getReportSummary(reviewerToken.access_token, sessionId)
    await client.getReport(reviewerToken.access_token, sessionId)
    const exportJob = await client.exportSession(reviewerToken.access_token, sessionId, `export-${randomUUID()}`)
    const exported = await client.waitForJobTerminalResult(reviewerToken.access_token, exportJob.job_id)
    if (exported.status !== "completed") {
      throw new Error(`Export job failed: ${JSON.stringify(exported.result)}`)
    }
    const exportRunId = String(exported.result["run_id"] ?? "")
    if (!exportRunId) {
      throw new Error("Export result missing run_id")
    }
    await client.getExport(reviewerToken.access_token, exportRunId)
    steps.push(toStep("report_export", `Report + export complete (run_id=${exportRunId})`))

    const redteamJob = await client.createRedteamRun(
      adminToken.access_token,
      { targetType: "session", targetId: sessionId },
      `demo-redteam-${randomUUID()}`,
    )
    const redteamResult = await client.waitForJobTerminalResult(adminToken.access_token, redteamJob.job_id)
    if (redteamResult.status !== "completed") {
      throw new Error(`Red-team job failed: ${JSON.stringify(redteamResult.result)}`)
    }
    const redteamRunId = String(redteamResult.result["id"] ?? "")
    if (!redteamRunId) {
      throw new Error("Red-team run id missing")
    }
    const redteamRun = await client.getRedteamRun(adminToken.access_token, redteamRunId)
    steps.push(
      toStep(
        "redteam",
        `Red-team job=${redteamJob.job_id} run=${redteamRunId} findings=${redteamRun.findings.length}`,
      ),
    )

    const fairnessJob = await client.createFairnessSmokeRun(
      adminToken.access_token,
      { scope: "tenant_recent", includeLanguageProxy: true },
      `demo-fairness-${randomUUID()}`,
    )
    const fairnessResult = await client.waitForJobTerminalResult(adminToken.access_token, fairnessJob.job_id)
    if (fairnessResult.status !== "completed") {
      throw new Error(`Fairness job failed: ${JSON.stringify(fairnessResult.result)}`)
    }
    const fairnessRunId = String(fairnessResult.result["id"] ?? "")
    if (!fairnessRunId) {
      throw new Error("Fairness run id missing")
    }
    const fairnessRun = await client.getFairnessSmokeRun(adminToken.access_token, fairnessRunId)
    const fairnessSummary = fairnessRun.summary as Record<string, unknown>
    const fairnessSampleSizeRaw = fairnessSummary["sample_size"]
    const fairnessSampleSize = typeof fairnessSampleSizeRaw === "number" ? fairnessSampleSizeRaw : null
    steps.push(toStep("fairness", `Fairness job=${fairnessJob.job_id} run=${fairnessRunId}`))

    const [auditVerify, purgePreview, contextTraces] = await Promise.all([
      client.getAuditChainVerification(adminToken.access_token),
      client.purgeExpiredRawContentDryRun(adminToken.access_token),
      client.getContextInjectionTraces(reviewerToken.access_token, sessionId),
    ])

    const governanceChecks = [
      `audit_chain_valid=${auditVerify.valid}`,
      `audit_entries_checked=${auditVerify.checked_entries}`,
      `purge_preview_sessions=${purgePreview.purged_sessions}`,
      `context_trace_count=${contextTraces.items.length}`,
    ]
    steps.push(toStep("governance_checks", governanceChecks.join(" · ")))

    return {
      ...previous,
      status: "success",
      phase: "completed",
      selectedTemplateId,
      assessmentMode,
      completedAt: new Date().toISOString(),
      apiBaseUrl,
      tenantId,
      caseId,
      taskFamilyId,
      sessionId,
      exportRunId,
      confidence: summary.confidence,
      steps,
      error: null,
      redteamJobId: redteamJob.job_id,
      redteamRunId,
      redteamRequestId: redteamRun.request_id ?? null,
      fairnessJobId: fairnessJob.job_id,
      fairnessRunId,
      fairnessRequestId: fairnessRun.request_id ?? null,
      redteamFindings: redteamRun.findings.length,
      fairnessSampleSize,
      seedManifest: summarizeSeedManifest(mode, seedEntries),
      governanceBundle: {
        generatedAt: new Date().toISOString(),
        checks: governanceChecks,
      },
    }
  } catch (error) {
    steps.push({
      name: "flow_failed",
      ok: false,
      detail: toErrorMessage(error),
      requestId: error instanceof MoonshotApiError ? error.requestId : null,
    })

    const base = intent === "prepare" ? initialDemoRunState : previous
    return {
      ...base,
      status: "error",
      mode,
      phase: intent === "prepare" ? "idle" : previous.phase,
      selectedTemplateId,
      assessmentMode,
      apiBaseUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      tenantId,
      steps,
      error: toErrorMessage(error),
      seedManifest: seedEntries.length > 0 ? summarizeSeedManifest(mode, seedEntries) : previous.seedManifest,
    }
  }
}

export interface DemoPreviewVariant {
  id: string
  skill: string
  difficultyLevel: string
  roundHint: string
  promptSummary: string
  deliverables: string[]
  estimatedMinutes: number
  artifactRefs: string[]
}

export interface DemoPreviewRubric {
  key: string
  anchor: string
  evaluationPoints: string[]
  evidenceSignals: string[]
  commonFailureModes: string[]
  scoreBands: Record<string, string>
}

export interface PrepareDemoPreviewResult {
  mode: DemoExecutionMode
  caseId: string | null
  taskFamilyId: string | null
  generatedVariantCount: number
  variants: DemoPreviewVariant[]
  rubric: DemoPreviewRubric[]
  diagnostics: DemoStageDiagnostic[]
  error: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === "string")
}

function toPreviewVariant(index: number, raw: unknown): DemoPreviewVariant {
  const row = asRecord(raw) ?? {}
  const prompt = typeof row.prompt === "string" ? row.prompt : ""
  const promptSummary = prompt.length > 240 ? `${prompt.slice(0, 237)}...` : prompt
  const skill = typeof row.skill === "string" && row.skill.trim() ? row.skill : "analysis"
  const difficultyLevel =
    typeof row.difficulty_level === "string" && row.difficulty_level.trim()
      ? row.difficulty_level
      : "foundation"
  const roundHint =
    typeof row.round_hint === "string" && row.round_hint.trim() ? row.round_hint : "round_1"
  const estimatedMinutes = typeof row.estimated_minutes === "number" ? row.estimated_minutes : 15
  return {
    id: typeof row.id === "string" ? row.id : `var_${index + 1}`,
    skill,
    difficultyLevel,
    roundHint,
    promptSummary,
    deliverables: asStringArray(row.deliverables),
    estimatedMinutes,
    artifactRefs: asStringArray(row.artifact_refs),
  }
}

function toPreviewRubric(raw: unknown): DemoPreviewRubric {
  const row = asRecord(raw) ?? {}
  const scoreBandsRaw = asRecord(row.score_bands)
  const scoreBands: Record<string, string> = {}
  if (scoreBandsRaw) {
    Object.entries(scoreBandsRaw).forEach(([key, value]) => {
      if (typeof value === "string") {
        scoreBands[key] = value
      }
    })
  }
  return {
    key: typeof row.key === "string" ? row.key : "dimension",
    anchor: typeof row.anchor === "string" ? row.anchor : "",
    evaluationPoints: asStringArray(row.evaluation_points),
    evidenceSignals: asStringArray(row.evidence_signals),
    commonFailureModes: asStringArray(row.common_failure_modes),
    scoreBands,
  }
}

function modeFromInput(mode: DemoExecutionMode | undefined): DemoExecutionMode {
  return mode === "live" ? "live" : "fixture"
}

export interface LiveModelOption {
  id: string
  label: string
}

export interface LiveModelOptionsResult {
  options: LiveModelOption[]
  availableModelIds: string[]
  defaultModelId: string
  error: string | null
}

function collectModelIdsFromLiteLLMInfo(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) {
    return []
  }
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) {
    return []
  }
  const ids = new Set<string>()
  data.forEach((item) => {
    if (typeof item !== "object" || item === null) {
      return
    }
    const row = item as { model_name?: unknown; litellm_params?: unknown }
    if (typeof row.model_name === "string" && row.model_name.trim()) {
      ids.add(row.model_name.trim())
    }
    if (typeof row.litellm_params === "object" && row.litellm_params !== null) {
      const model = (row.litellm_params as { model?: unknown }).model
      if (typeof model === "string" && model.trim()) {
        ids.add(model.trim())
      }
    }
  })
  return Array.from(ids)
}

export async function loadLiveModelOptions(): Promise<LiveModelOptionsResult> {
  try {
    const client = createMoonshotClientFromEnv()
    const response = await client.getModelOptions()

    const availableIds = new Set<string>()
    const optionsMap = new Map<string, LiveModelOption>()
    response.options.forEach((item) => {
      if (!item.available) return
      const resolved = (item.resolved_model ?? "").trim()
      const canonical = item.model.trim()
      if (canonical) {
        availableIds.add(canonical)
      }
      if (resolved) {
        availableIds.add(resolved)
      }
      const id = resolved || canonical
      if (!id) return
      if (!optionsMap.has(id)) {
        const label = resolved && resolved !== canonical ? `${canonical} (${resolved})` : canonical
        optionsMap.set(id, { id, label })
      }
    })

    const litellmBaseUrl = (process.env.MOONSHOT_LITELLM_BASE_URL ?? "").trim()
    const litellmApiKey = (process.env.MOONSHOT_LITELLM_API_KEY ?? "").trim()
    if (litellmBaseUrl && litellmApiKey) {
      try {
        const endpoint = `${litellmBaseUrl.replace(/\/+$/, "")}/v1/model/info`
        const response = await fetch(endpoint, {
          method: "GET",
          headers: { Authorization: `Bearer ${litellmApiKey}` },
          cache: "no-store",
        })
        if (response.ok) {
          const payload = await response.json()
          collectModelIdsFromLiteLLMInfo(payload).forEach((id) => availableIds.add(id))
        }
      } catch {
        // Keep model options usable even when external model-info endpoint is unavailable.
      }
    }

    const options = Array.from(optionsMap.values())
    const defaultRequiredModel = response.defaults_by_agent.evaluator ?? DEMO_LIVE_DEFAULT_MODEL
    const defaultResolved = response.options.find(
      (item) => item.model === defaultRequiredModel && item.available,
    )?.resolved_model
    const defaultModelId = normalizeLiveModelOverride(defaultResolved ?? defaultRequiredModel ?? options[0]?.id)

    if (!options.some((opt) => opt.id === defaultModelId)) {
      options.unshift({ id: defaultModelId, label: defaultRequiredModel })
    }

    return {
      options,
      availableModelIds: Array.from(availableIds).sort(),
      defaultModelId,
      error: null,
    }
  } catch (error) {
    return {
      options: [{ id: DEMO_LIVE_DEFAULT_MODEL, label: DEMO_LIVE_DEFAULT_MODEL }],
      availableModelIds: [DEMO_LIVE_DEFAULT_MODEL],
      defaultModelId: DEMO_LIVE_DEFAULT_MODEL,
      error: toErrorMessage(error),
    }
  }
}

export async function prepareDemoPreview(
  templateId: string,
  modeInput: DemoExecutionMode = "fixture",
  liveModelOverride?: string | null,
  liveReasoningEffort?: string | null,
  liveCoDesignBundle?: LiveCoDesignPromptBundle | null,
): Promise<PrepareDemoPreviewResult> {
  const mode = modeFromInput(modeInput)
  const selectedLiveModel = normalizeLiveModelOverride(liveModelOverride)
  const selectedReasoningEffort = normalizeLiveReasoningEffort(liveReasoningEffort)
  const diagnostics: DemoStageDiagnostic[] = []
  try {
    const client = createMoonshotClientFromEnv()
    const template = DEMO_CASE_TEMPLATES.find((item) => item.id === templateId)
    if (!template) {
      return {
        mode,
        caseId: null,
        taskFamilyId: null,
        generatedVariantCount: 0,
        variants: [],
        rubric: [],
        diagnostics,
        error: `Unknown template: ${templateId}`,
      }
    }

    const adminToken = await client.issueToken("org_admin", client.config.adminUserId)

    const workerStartedAt = stageStartedAt()
    const workerReadinessError = await getWorkerReadinessError(client, adminToken.access_token)
    if (workerReadinessError) {
      diagnostics.push({
        stage: "worker_health",
        status: "error",
        latency_ms: stageLatencyMs(workerStartedAt),
        detail: workerReadinessError,
        job_id: null,
        request_id: null,
        model: null,
      })
      return {
        mode,
        caseId: null,
        taskFamilyId: null,
        generatedVariantCount: 0,
        variants: [],
        rubric: [],
        diagnostics,
        error: workerReadinessError,
      }
    }
    diagnostics.push({
      stage: "worker_health",
      status: "ok",
      latency_ms: stageLatencyMs(workerStartedAt),
      detail: "Worker pool healthy",
      job_id: null,
      request_id: null,
      model: null,
    })

    const createStartedAt = stageStartedAt()
    const createdCase = await client.createCase(
      adminToken.access_token,
      buildCaseCreatePayload(template, mode, liveCoDesignBundle),
    )
    diagnostics.push({
      stage: "create_case",
      status: "ok",
      latency_ms: stageLatencyMs(createStartedAt),
      detail: `Case created (${createdCase.id})`,
      job_id: null,
      request_id: null,
      model: null,
    })

    const generateStartedAt = stageStartedAt()
    const generateJob = await client.generateCase(
      adminToken.access_token,
      createdCase.id,
      `demo-preview-gen-${randomUUID()}`,
      {
        mode,
        template_id: mode === "fixture" ? templateId : undefined,
        variant_count: 12,
        model_override: mode === "live" ? selectedLiveModel : undefined,
        reasoning_effort: mode === "live" ? selectedReasoningEffort : undefined,
        thinking_budget_tokens: mode === "live" ? DEMO_LIVE_DEFAULT_THINKING_BUDGET_TOKENS : undefined,
      },
    )
    const generated = await client.waitForJobTerminalResult(
      adminToken.access_token,
      generateJob.job_id,
      jobWaitForMode(mode),
    )

    if (generated.status !== "completed") {
      const failure = `Generate job failed: ${generated.status}`
      diagnostics.push({
        stage: "generate",
        status: "error",
        latency_ms: stageLatencyMs(generateStartedAt),
        detail: failure,
        job_id: generateJob.job_id,
        request_id: null,
        model: null,
      })
      return {
        mode,
        caseId: createdCase.id,
        taskFamilyId: null,
        generatedVariantCount: 0,
        variants: [],
        rubric: [],
        diagnostics,
        error: failure,
      }
    }

    const resultRecord = asRecord(generated.result)
    const taskFamily = asRecord(resultRecord?.task_family)
    const rubric = asRecord(resultRecord?.rubric)
    const trace = asRecord(resultRecord?.model_trace)
    const taskFamilyId = typeof taskFamily?.id === "string" ? taskFamily.id : null
    if (!taskFamilyId) {
      const failure = "Generate result missing task_family.id"
      diagnostics.push({
        stage: "generate",
        status: "error",
        latency_ms: stageLatencyMs(generateStartedAt),
        detail: failure,
        job_id: generateJob.job_id,
        request_id: null,
        model: null,
      })
      return {
        mode,
        caseId: createdCase.id,
        taskFamilyId: null,
        generatedVariantCount: 0,
        variants: [],
        rubric: [],
        diagnostics,
        error: failure,
      }
    }

    const variantsRaw = Array.isArray(taskFamily?.variants) ? taskFamily.variants : []
    const rubricRaw = Array.isArray(rubric?.dimensions) ? rubric.dimensions : []
    const model =
      typeof trace?.provider === "string" && typeof trace?.model === "string"
        ? `${trace.provider}/${trace.model}`
        : null

    diagnostics.push({
      stage: "generate",
      status: "ok",
      latency_ms: stageLatencyMs(generateStartedAt),
      detail: `Generated ${variantsRaw.length} variants`,
      job_id: generateJob.job_id,
      request_id: null,
      model,
    })

    return {
      mode,
      caseId: createdCase.id,
      taskFamilyId,
      generatedVariantCount: variantsRaw.length,
      variants: variantsRaw.map((variant, idx) => toPreviewVariant(idx, variant)),
      rubric: rubricRaw.map((item) => toPreviewRubric(item)),
      diagnostics,
      error: null,
    }
  } catch (error) {
    const failureDetail = toErrorMessage(error)
    return {
      mode,
      caseId: null,
      taskFamilyId: null,
      generatedVariantCount: 0,
      variants: [],
      rubric: [],
      diagnostics: appendFailureDiagnostic(diagnostics, failureDetail),
      error: failureDetail,
    }
  }
}

export interface FastPathResult {
  mode: DemoExecutionMode
  sessionId: string | null
  candidateUrl: string | null
  taskFamilyId: string | null
  generatedVariantCount: number | null
  diagnostics: DemoStageDiagnostic[]
  error: string | null
}

interface RunDemoFastPathInput {
  mode?: DemoExecutionMode
  preparedCaseId?: string | null
  preparedTaskFamilyId?: string | null
  preparedVariantCount?: number | null
  previewDiagnostics?: DemoStageDiagnostic[] | null
  liveModelOverride?: string | null
  liveReasoningEffort?: string | null
  liveCoDesignBundle?: LiveCoDesignPromptBundle | null
}

export async function runDemoFastPath(
  templateId: string,
  input: RunDemoFastPathInput = {},
): Promise<FastPathResult> {
  const mode = modeFromInput(input.mode)
  const selectedLiveModel = normalizeLiveModelOverride(input.liveModelOverride)
  const selectedReasoningEffort = normalizeLiveReasoningEffort(input.liveReasoningEffort)
  const diagnostics: DemoStageDiagnostic[] = Array.isArray(input.previewDiagnostics)
    ? [...input.previewDiagnostics]
    : []
  try {
    const client = createMoonshotClientFromEnv()

    const template = DEMO_CASE_TEMPLATES.find((item) => item.id === templateId)
    if (!template) {
      return {
        mode,
        sessionId: null,
        candidateUrl: null,
        taskFamilyId: null,
        generatedVariantCount: null,
        diagnostics,
        error: `Unknown template: ${templateId}`,
      }
    }

    const [adminToken, reviewerToken] = await Promise.all([
      client.issueToken("org_admin", client.config.adminUserId),
      client.issueToken("reviewer", client.config.reviewerUserId),
    ])

    const workerStartedAt = stageStartedAt()
    const workerReadinessError = await getWorkerReadinessError(client, adminToken.access_token)
    if (workerReadinessError) {
      diagnostics.push({
        stage: "worker_health",
        status: "error",
        latency_ms: stageLatencyMs(workerStartedAt),
        detail: workerReadinessError,
        job_id: null,
        request_id: null,
        model: null,
      })
      return {
        mode,
        sessionId: null,
        candidateUrl: null,
        taskFamilyId: null,
        generatedVariantCount: null,
        diagnostics,
        error: workerReadinessError,
      }
    }
    diagnostics.push({
      stage: "worker_health",
      status: "ok",
      latency_ms: stageLatencyMs(workerStartedAt),
      detail: "Worker pool healthy",
      job_id: null,
      request_id: null,
      model: null,
    })

    let caseId = input.preparedCaseId ?? null
    let taskFamilyId = input.preparedTaskFamilyId ?? null
    let generatedVariantCount = input.preparedVariantCount ?? null

    if (!caseId || !taskFamilyId) {
      const createStartedAt = stageStartedAt()
      const createdCase = await client.createCase(
        adminToken.access_token,
        buildCaseCreatePayload(template, mode, input.liveCoDesignBundle),
      )
      caseId = createdCase.id
      diagnostics.push({
        stage: "create_case",
        status: "ok",
        latency_ms: stageLatencyMs(createStartedAt),
        detail: `Case created (${caseId})`,
        job_id: null,
        request_id: null,
        model: null,
      })

      const generateStartedAt = stageStartedAt()
      const generateJob = await client.generateCase(
        adminToken.access_token,
        caseId,
        `demo-fp-gen-${randomUUID()}`,
        {
          mode,
          template_id: mode === "fixture" ? templateId : undefined,
          variant_count: 12,
          model_override: mode === "live" ? selectedLiveModel : undefined,
          reasoning_effort: mode === "live" ? selectedReasoningEffort : undefined,
          thinking_budget_tokens: mode === "live" ? DEMO_LIVE_DEFAULT_THINKING_BUDGET_TOKENS : undefined,
        },
      )
      const generated = await client.waitForJobTerminalResult(
        adminToken.access_token,
        generateJob.job_id,
        jobWaitForMode(mode),
      )
      if (generated.status !== "completed") {
        const failure = `Generate job failed: ${generated.status}`
        diagnostics.push({
          stage: "generate",
          status: "error",
          latency_ms: stageLatencyMs(generateStartedAt),
          detail: failure,
          job_id: generateJob.job_id,
          request_id: null,
          model: null,
        })
        return {
          mode,
          sessionId: null,
          candidateUrl: null,
          taskFamilyId: null,
          generatedVariantCount: null,
          diagnostics,
          error: failure,
        }
      }

      const resultRecord = asRecord(generated.result)
      const taskFamily = asRecord(resultRecord?.task_family)
      const trace = asRecord(resultRecord?.model_trace)
      const resolvedTaskFamilyId = typeof taskFamily?.id === "string" ? taskFamily.id : null
      if (!resolvedTaskFamilyId) {
        const failure = "Generate result missing task_family.id"
        diagnostics.push({
          stage: "generate",
          status: "error",
          latency_ms: stageLatencyMs(generateStartedAt),
          detail: failure,
          job_id: generateJob.job_id,
          request_id: null,
          model: null,
        })
        return {
          mode,
          sessionId: null,
          candidateUrl: null,
          taskFamilyId: null,
          generatedVariantCount: null,
          diagnostics,
          error: failure,
        }
      }

      taskFamilyId = resolvedTaskFamilyId
      const variants = Array.isArray(taskFamily?.variants) ? taskFamily.variants : []
      generatedVariantCount = variants.length
      const model =
        typeof trace?.provider === "string" && typeof trace?.model === "string"
          ? `${trace.provider}/${trace.model}`
          : null
      diagnostics.push({
        stage: "generate",
        status: "ok",
        latency_ms: stageLatencyMs(generateStartedAt),
        detail: `Generated ${generatedVariantCount} variants`,
        job_id: generateJob.job_id,
        request_id: null,
        model,
      })
    } else {
      diagnostics.push({
        stage: "generate",
        status: "ok",
        latency_ms: 1,
        detail: `Reusing prepared preview task family (${taskFamilyId})`,
        job_id: null,
        request_id: null,
        model: null,
      })
    }

    const publishStartedAt = stageStartedAt()
    await client.reviewTaskFamily(reviewerToken.access_token, taskFamilyId)
    await client.publishTaskFamily(reviewerToken.access_token, taskFamilyId)
    diagnostics.push({
      stage: "publish",
      status: "ok",
      latency_ms: stageLatencyMs(publishStartedAt),
      detail: `Task family published (${taskFamilyId})`,
      job_id: null,
      request_id: null,
      model: null,
    })

    const sessionStartedAt = stageStartedAt()
    const session = await client.createSession(
      reviewerToken.access_token,
      taskFamilyId,
      client.config.candidateUserId,
      {
        demo_template_id: templateId,
        demo_mode: mode,
        sample_script_version: mode === "live" ? "live-v1" : "fixture-v2",
      },
    )
    await client.setSessionMode(reviewerToken.access_token, session.id, "assessment")
    diagnostics.push({
      stage: "create_session",
      status: "ok",
      latency_ms: stageLatencyMs(sessionStartedAt),
      detail: `Session created (${session.id})`,
      job_id: null,
      request_id: null,
      model: null,
    })

    return {
      mode,
      sessionId: session.id,
      candidateUrl: `/session/${session.id}/start`,
      taskFamilyId,
      generatedVariantCount,
      diagnostics,
      error: null,
    }
  } catch (error) {
    const failureDetail = toErrorMessage(error)
    return {
      mode,
      sessionId: null,
      candidateUrl: null,
      taskFamilyId: null,
      generatedVariantCount: null,
      diagnostics: appendFailureDiagnostic(diagnostics, failureDetail),
      error: failureDetail,
    }
  }
}

export interface AutoCompleteResult {
  mode: DemoExecutionMode
  sessionId: string
  reportReady: boolean
  diagnostics: DemoStageDiagnostic[]
  error: string | null
}

export async function runDemoAutoComplete(
  sessionId: string,
  templateId: string,
  modeInput: DemoExecutionMode = "fixture",
  liveModelOverride?: string | null,
  liveReasoningEffort?: string | null,
): Promise<AutoCompleteResult> {
  // fixture contract marker: { mode: "fixture", template_id: templateId }
  const mode = modeFromInput(modeInput)
  const selectedLiveModel = normalizeLiveModelOverride(liveModelOverride)
  const selectedReasoningEffort = normalizeLiveReasoningEffort(liveReasoningEffort)
  const diagnostics: DemoStageDiagnostic[] = []
  try {
    const client = createMoonshotClientFromEnv()
    const adminToken = await client.issueToken("org_admin", client.config.adminUserId)
    const reviewerToken = await client.issueToken("reviewer", client.config.reviewerUserId)
    const candidateToken = await client.issueToken("candidate", client.config.candidateUserId)

    const workerStartedAt = stageStartedAt()
    const workerReadinessError = await getWorkerReadinessError(client, adminToken.access_token)
    if (workerReadinessError) {
      diagnostics.push({
        stage: "worker_health",
        status: "error",
        latency_ms: stageLatencyMs(workerStartedAt),
        detail: workerReadinessError,
        job_id: null,
        request_id: null,
        model: null,
      })
      return { mode, sessionId, reportReady: false, diagnostics, error: workerReadinessError }
    }
    diagnostics.push({
      stage: "worker_health",
      status: "ok",
      latency_ms: stageLatencyMs(workerStartedAt),
      detail: "Worker pool healthy",
      job_id: null,
      request_id: null,
      model: null,
    })

    const fixture = DEMO_FIXTURES[templateId]
    if (!fixture) {
      return { mode, sessionId, reportReady: false, diagnostics, error: `No fixture data for template: ${templateId}` }
    }

    await client.ingestEvents(candidateToken.access_token, sessionId, fixture.sampleEvents)

    await client.submitSession(candidateToken.access_token, sessionId, fixture.finalResponse)

    const scoreStartedAt = stageStartedAt()
    const scoreJob = await client.scoreSession(
      reviewerToken.access_token,
      sessionId,
      `demo-score-${randomUUID()}`,
      {
        mode,
        template_id: mode === "fixture" ? templateId : undefined,
        model_override: mode === "live" ? selectedLiveModel : undefined,
        reasoning_effort: mode === "live" ? selectedReasoningEffort : undefined,
        thinking_budget_tokens: mode === "live" ? DEMO_LIVE_DEFAULT_THINKING_BUDGET_TOKENS : undefined,
      },
    )
    const scored = await client.waitForJobTerminalResult(
      reviewerToken.access_token,
      scoreJob.job_id,
      jobWaitForMode(mode),
    )
    if (scored.status !== "completed") {
      const failure = `Score job failed: ${scored.status}`
      diagnostics.push({
        stage: "score",
        status: "error",
        latency_ms: stageLatencyMs(scoreStartedAt),
        detail: failure,
        job_id: scoreJob.job_id,
        request_id: null,
        model: null,
      })
      return { mode, sessionId, reportReady: false, diagnostics, error: failure }
    }
    diagnostics.push({
      stage: "score",
      status: "ok",
      latency_ms: stageLatencyMs(scoreStartedAt),
      detail: "Scoring completed",
      job_id: scoreJob.job_id,
      request_id: null,
      model: mode === "live" ? selectedLiveModel : null,
    })

    const exportStartedAt = stageStartedAt()
    const exportJob = await client.exportSession(
      reviewerToken.access_token,
      sessionId,
      `demo-export-${randomUUID()}`,
    )
    const exported = await client.waitForJobTerminalResult(
      reviewerToken.access_token,
      exportJob.job_id,
      jobWaitForMode(mode),
    )
    if (exported.status !== "completed") {
      const failure = `Export job failed: ${exported.status}`
      diagnostics.push({
        stage: "export",
        status: "error",
        latency_ms: stageLatencyMs(exportStartedAt),
        detail: failure,
        job_id: exportJob.job_id,
        request_id: null,
        model: null,
      })
      return { mode, sessionId, reportReady: false, diagnostics, error: failure }
    }
    diagnostics.push({
      stage: "export",
      status: "ok",
      latency_ms: stageLatencyMs(exportStartedAt),
      detail: "Report export completed",
      job_id: exportJob.job_id,
      request_id: null,
      model: null,
    })

    return { mode, sessionId, reportReady: true, diagnostics, error: null }
  } catch (error) {
    const failureDetail = toErrorMessage(error)
    return {
      mode,
      sessionId,
      reportReady: false,
      diagnostics: appendFailureDiagnostic(diagnostics, failureDetail),
      error: failureDetail,
    }
  }
}
