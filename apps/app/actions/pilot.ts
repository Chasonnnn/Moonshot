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
import { DEMO_CASE_TEMPLATES } from "@/lib/moonshot/demo-case-templates"
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
      client.listJobs(adminToken.access_token, 20),
    ])

    return {
      ok: true,
      apiVersion: meta.api_version,
      schemaVersion: meta.schema_version,
      caseCount: cases.items.length,
      jobCount: jobs.items.length,
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

export interface FastPathResult {
  sessionId: string | null
  candidateUrl: string | null
  error: string | null
}

export async function runDemoFastPath(templateId: string): Promise<FastPathResult> {
  try {
    const client = createMoonshotClientFromEnv()

    const template = DEMO_CASE_TEMPLATES.find((item) => item.id === templateId)
    if (!template) {
      return { sessionId: null, candidateUrl: null, error: `Unknown template: ${templateId}` }
    }

    const adminToken = await client.issueToken("org_admin", client.config.adminUserId)
    const reviewerToken = await client.issueToken("reviewer", client.config.reviewerUserId)

    const createdCase = await client.createCase(adminToken.access_token, {
      title: `[Demo] ${template.title}`,
      scenario: template.scenario,
      artifacts: template.artifacts,
      metrics: [],
      allowed_tools: ["sql_workspace", "python_workspace", "dashboard_workspace", "copilot"],
    })

    const generateJob = await client.generateCase(
      adminToken.access_token,
      createdCase.id,
      `demo-fp-gen-${randomUUID()}`,
      { mode: "fixture", template_id: templateId },
    )
    const generated = await client.waitForJobTerminalResult(adminToken.access_token, generateJob.job_id)
    if (generated.status !== "completed") {
      return { sessionId: null, candidateUrl: null, error: `Generate job failed: ${generated.status}` }
    }

    const taskFamily = generated.result["task_family"] as Record<string, unknown> | undefined
    const taskFamilyId = String(taskFamily?.["id"] ?? "")
    if (!taskFamilyId) {
      return { sessionId: null, candidateUrl: null, error: "Generate result missing task_family.id" }
    }

    await client.reviewTaskFamily(reviewerToken.access_token, taskFamilyId)
    await client.publishTaskFamily(reviewerToken.access_token, taskFamilyId)

    const session = await client.createSession(reviewerToken.access_token, taskFamilyId, client.config.candidateUserId, {
      demo_template_id: templateId,
      sample_script_version: "fixture-v1",
    })
    await client.setSessionMode(reviewerToken.access_token, session.id, "assessment")

    return {
      sessionId: session.id,
      candidateUrl: `/session/${session.id}/start`,
      error: null,
    }
  } catch (error) {
    return {
      sessionId: null,
      candidateUrl: null,
      error: toErrorMessage(error),
    }
  }
}

export interface AutoCompleteResult {
  sessionId: string
  reportReady: boolean
  error: string | null
}

export async function runDemoAutoComplete(
  sessionId: string,
  templateId: string,
): Promise<AutoCompleteResult> {
  try {
    const client = createMoonshotClientFromEnv()
    const reviewerToken = await client.issueToken("reviewer", client.config.reviewerUserId)
    const candidateToken = await client.issueToken("candidate", client.config.candidateUserId)

    const fixture = DEMO_FIXTURES[templateId]
    if (!fixture) {
      return { sessionId, reportReady: false, error: `No fixture data for template: ${templateId}` }
    }

    await client.ingestEvents(candidateToken.access_token, sessionId, fixture.sampleEvents)

    await client.submitSession(candidateToken.access_token, sessionId, fixture.finalResponse)

    const scoreJob = await client.scoreSession(
      reviewerToken.access_token,
      sessionId,
      `demo-score-${randomUUID()}`,
      { mode: "fixture", template_id: templateId },
    )
    const scored = await client.waitForJobTerminalResult(reviewerToken.access_token, scoreJob.job_id)
    if (scored.status !== "completed") {
      return { sessionId, reportReady: false, error: `Score job failed: ${scored.status}` }
    }

    const exportJob = await client.exportSession(
      reviewerToken.access_token,
      sessionId,
      `demo-export-${randomUUID()}`,
    )
    const exported = await client.waitForJobTerminalResult(reviewerToken.access_token, exportJob.job_id)
    if (exported.status !== "completed") {
      return { sessionId, reportReady: false, error: `Export job failed: ${exported.status}` }
    }

    return { sessionId, reportReady: true, error: null }
  } catch (error) {
    return { sessionId, reportReady: false, error: toErrorMessage(error) }
  }
}
