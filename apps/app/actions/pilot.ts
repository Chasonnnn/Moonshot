"use server"

import { randomUUID } from "node:crypto"

import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import { type PilotFlowState, type PilotFlowStep, type PilotSnapshot } from "@/lib/moonshot/pilot-flow"
import { MoonshotApiError } from "@/lib/moonshot/types"

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

    const generateJob = await client.generateCase(adminToken.access_token, createdCase.id, `generate-${randomUUID()}`)
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
    steps.push(toStep("wait_generate_job", `Task family generated (${taskFamilyId})`))

    await client.reviewTaskFamily(reviewerToken.access_token, taskFamilyId)
    steps.push(toStep("review_task_family", "Task family approved"))

    await client.publishTaskFamily(reviewerToken.access_token, taskFamilyId)
    steps.push(toStep("publish_task_family", "Task family published"))

    const session = await client.createSession(reviewerToken.access_token, taskFamilyId, client.config.candidateUserId)
    steps.push(toStep("create_session", `Session created (${session.id})`))

    await client.setSessionMode(reviewerToken.access_token, session.id, "assessment")
    steps.push(toStep("set_session_mode", "Coach mode set to assessment"))

    await client.ingestEvents(candidateToken.access_token, session.id, [
      { event_type: "sql_query_run", payload: { time_to_first_action_ms: 920 } },
      { event_type: "copilot_invoked", payload: {} },
      { event_type: "verification_step_completed", payload: {} },
    ])
    steps.push(toStep("ingest_events", "Candidate events ingested"))

    const coachReply = await client.coachMessage(
      candidateToken.access_token,
      session.id,
      "Can you clarify what validation evidence I should include before escalation?",
    )
    steps.push(toStep("coach_message", `${coachReply.policy_reason}`))

    await client.submitSession(
      candidateToken.access_token,
      session.id,
      "I would segment retention by cohort and verify data quality before escalating with concrete caveats.",
    )
    steps.push(toStep("submit_session", "Candidate submission completed"))

    const scoreJob = await client.scoreSession(reviewerToken.access_token, session.id, `score-${randomUUID()}`)
    steps.push(toStep("submit_score_job", `Score job submitted (${scoreJob.job_id})`))

    const scored = await client.waitForJobTerminalResult(reviewerToken.access_token, scoreJob.job_id)
    if (scored.status !== "completed") {
      throw new Error(`Score job failed: ${JSON.stringify(scored.result)}`)
    }
    steps.push(toStep("wait_score_job", "Score job completed"))

    const summary = await client.getReportSummary(reviewerToken.access_token, session.id)
    steps.push(toStep("read_report_summary", `Summary read (confidence=${summary.confidence ?? "n/a"})`))

    await client.getReport(reviewerToken.access_token, session.id)
    steps.push(toStep("read_report", "Detailed report retrieved"))

    const exportJob = await client.exportSession(reviewerToken.access_token, session.id, `export-${randomUUID()}`)
    steps.push(toStep("submit_export_job", `Export job submitted (${exportJob.job_id})`))

    const exported = await client.waitForJobTerminalResult(reviewerToken.access_token, exportJob.job_id)
    if (exported.status !== "completed") {
      throw new Error(`Export job failed: ${JSON.stringify(exported.result)}`)
    }
    const exportRunId = String(exported.result["run_id"] ?? "")
    if (!exportRunId) {
      throw new Error("Export result missing run_id")
    }
    steps.push(toStep("wait_export_job", `Export job completed (${exportRunId})`))

    await client.getExport(reviewerToken.access_token, exportRunId)
    steps.push(toStep("read_export_bundle", "Export bundle retrieved"))

    return {
      status: "success",
      startedAt,
      completedAt: new Date().toISOString(),
      tenantId,
      caseId: createdCase.id,
      taskFamilyId,
      sessionId: session.id,
      exportRunId,
      confidence: summary.confidence,
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
