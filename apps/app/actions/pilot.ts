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

interface FixtureScenario {
  scenarioId: string
  title: string
  scenario: string
  artifacts: Array<{ type: string; name: string }>
}

const FIXTURE_SCENARIOS: FixtureScenario[] = [
  {
    scenarioId: "jda_s1",
    title: "KPI Discrepancy Investigation",
    scenario: "Find root cause of conversion decline and propose next actions.",
    artifacts: [
      { type: "csv", name: "funnel_weekly.csv" },
      { type: "md", name: "tracking_notes.md" },
    ],
  },
  {
    scenarioId: "jda_s2",
    title: "SQL Data Quality Triage",
    scenario: "Resolve conflicting row counts between source and dashboard.",
    artifacts: [
      { type: "csv", name: "orders.csv" },
      { type: "csv", name: "customers.csv" },
      { type: "log", name: "etl_log.txt" },
    ],
  },
  {
    scenarioId: "jda_s3",
    title: "Stakeholder Ambiguity Handling",
    scenario: "Respond to vague stakeholder request with assumptions and escalation plan.",
    artifacts: [
      { type: "txt", name: "request_thread.txt" },
      { type: "csv", name: "metric_dictionary.csv" },
    ],
  },
]

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

function parseDemoMode(formData: FormData | undefined): DemoSeedMode {
  const raw = formData?.get("mode")
  if (raw === "fixture" || raw === "fresh" || raw === "both") {
    return raw
  }
  return initialDemoRunState.mode
}

function parseAssessmentMode(formData: FormData | undefined): SessionMode {
  const raw = String(formData?.get("assessment_mode") ?? "").trim()
  if (raw === "practice" || raw === "assessment" || raw === "assessment_no_ai" || raw === "assessment_ai_assisted") {
    return raw
  }
  return initialDemoRunState.assessmentMode
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
  void previous
  const startedAt = new Date().toISOString()
  const mode = parseDemoMode(formData)
  const assessmentMode = parseAssessmentMode(formData)
  const steps: PilotFlowStep[] = []
  const seedEntries: ScenarioSeedEntry[] = []
  let tenantId: string | null = null
  let apiBaseUrl: string | null = null

  try {
    const client = createMoonshotClientFromEnv()
    tenantId = client.config.tenantId
    apiBaseUrl = client.config.baseUrl
    const [adminToken, reviewerToken, candidateToken, meta] = await Promise.all([
      client.issueToken("org_admin", client.config.adminUserId),
      client.issueToken("reviewer", client.config.reviewerUserId),
      client.issueToken("candidate", client.config.candidateUserId),
      client.getMetaVersion(),
    ])
    steps.push(toStep("health", `Connected to API ${meta.api_version}`))

    let caseIdForRun: string | null = null

    if (mode === "fixture" || mode === "both") {
      for (const fixture of FIXTURE_SCENARIOS) {
        const seededCase = await client.createCase(adminToken.access_token, {
          title: `[Fixture] ${fixture.title}`,
          scenario: fixture.scenario,
          artifacts: fixture.artifacts,
          metrics: [],
          allowed_tools: ["sql_workspace", "dashboard_workspace", "copilot"],
        })
        seedEntries.push({
          source: "fixture",
          scenarioId: fixture.scenarioId,
          title: fixture.title,
          caseId: seededCase.id,
        })
        if (caseIdForRun === null) {
          caseIdForRun = seededCase.id
        }
      }
    }

    if (mode === "fresh" || mode === "both") {
      const freshCase = await client.createCase(adminToken.access_token, {
        title: `JDA Fresh Demo Case ${new Date().toISOString()}`,
        scenario: "Investigate conversion drop and recommend actions with explicit caveats and escalation logic.",
        artifacts: [{ type: "csv", name: "conversion_drop.csv" }],
        metrics: [],
        allowed_tools: ["sql_workspace", "dashboard_workspace", "copilot"],
      })
      seedEntries.push({
        source: "fresh",
        scenarioId: "fresh_generated",
        title: "Fresh generated scenario",
        caseId: freshCase.id,
      })
      caseIdForRun = freshCase.id
    }

    if (caseIdForRun === null) {
      throw new Error("No case selected for demo run")
    }

    steps.push(toStep("seed_or_generate", `Seeded ${seedEntries.length} scenario(s); run case=${caseIdForRun}`))

    const flow = await runCaseToReportExportFlow({
      caseId: caseIdForRun,
      adminToken: adminToken.access_token,
      reviewerToken: reviewerToken.access_token,
      candidateToken: candidateToken.access_token,
      candidateUserId: client.config.candidateUserId,
      assessmentMode,
      steps,
    })

    const redteamJob = await client.createRedteamRun(
      adminToken.access_token,
      { targetType: "session", targetId: flow.sessionId },
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
      client.getContextInjectionTraces(reviewerToken.access_token, flow.sessionId),
    ])

    const governanceChecks = [
      `audit_chain_valid=${auditVerify.valid}`,
      `audit_entries_checked=${auditVerify.checked_entries}`,
      `purge_preview_sessions=${purgePreview.purged_sessions}`,
      `context_trace_count=${contextTraces.items.length}`,
    ]
    steps.push(toStep("governance_checks", governanceChecks.join(" · ")))

    return {
      status: "success",
      startedAt,
      completedAt: new Date().toISOString(),
      tenantId,
      apiBaseUrl,
      caseId: caseIdForRun,
      taskFamilyId: flow.taskFamilyId,
      sessionId: flow.sessionId,
      exportRunId: flow.exportRunId,
      confidence: flow.confidence,
      steps,
      error: null,
      mode,
      assessmentMode,
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
    return {
      ...initialDemoRunState,
      status: "error",
      mode,
      assessmentMode,
      apiBaseUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      tenantId,
      steps,
      error: toErrorMessage(error),
      seedManifest: summarizeSeedManifest(mode, seedEntries),
    }
  }
}
