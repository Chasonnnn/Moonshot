"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import { MoonshotApiError, type CaseSpec, type TaskFamily } from "@/lib/moonshot/types"

export interface CasesSnapshot {
  cases: CaseSpec[]
  taskFamilies: TaskFamily[]
  error: string | null
}

export interface CaseActionState {
  ok: boolean
  message: string
  error: string | null
  requestId: string | null
}

function toActionError(error: unknown): { error: string; requestId: string | null } {
  if (error instanceof MoonshotApiError) {
    return { error: `${error.errorCode}: ${error.errorDetail}`, requestId: error.requestId }
  }
  if (error instanceof Error) {
    return { error: error.message, requestId: null }
  }
  return { error: "Unknown error", requestId: null }
}

export async function loadCasesSnapshot(): Promise<CasesSnapshot> {
  try {
    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)
    const [cases, taskFamilies] = await Promise.all([
      client.listCases(reviewer.access_token),
      client.listTaskFamilies(reviewer.access_token),
    ])
    return { cases: cases.items, taskFamilies: taskFamilies.items, error: null }
  } catch (error) {
    const parsed = toActionError(error)
    return { cases: [], taskFamilies: [], error: `${parsed.error} (request_id=${parsed.requestId ?? "n/a"})` }
  }
}

export async function loadCaseDetail(
  caseId: string,
): Promise<{ caseItem: CaseSpec | null; taskFamilies: TaskFamily[]; error: string | null }> {
  try {
    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)
    const [caseItem, families] = await Promise.all([
      client.getCase(reviewer.access_token, caseId),
      client.listTaskFamilies(reviewer.access_token),
    ])
    return {
      caseItem,
      taskFamilies: families.items.filter((item) => item.case_id === caseId),
      error: null,
    }
  } catch (error) {
    const parsed = toActionError(error)
    return { caseItem: null, taskFamilies: [], error: `${parsed.error} (request_id=${parsed.requestId ?? "n/a"})` }
  }
}

export async function createCaseAction(_prev: CaseActionState, formData: FormData): Promise<CaseActionState> {
  try {
    const title = String(formData.get("title") ?? "").trim()
    const scenario = String(formData.get("scenario") ?? "").trim()
    if (!title || !scenario) {
      return { ok: false, message: "", error: "title and scenario are required", requestId: null }
    }

    const client = createMoonshotClientFromEnv()
    const admin = await client.issueToken("org_admin", client.config.adminUserId)
    const created = await client.createCase(admin.access_token, {
      title,
      scenario,
      artifacts: [],
      metrics: [],
      allowed_tools: ["sql_workspace", "dashboard_workspace", "copilot"],
    })

    revalidatePath("/cases")
    revalidatePath("/dashboard")
    return { ok: true, message: `Case created: ${created.id}`, error: null, requestId: null }
  } catch (error) {
    const parsed = toActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}

export async function updateCaseAction(_prev: CaseActionState, formData: FormData): Promise<CaseActionState> {
  try {
    const caseId = String(formData.get("case_id") ?? "").trim()
    const title = String(formData.get("title") ?? "").trim()
    const scenario = String(formData.get("scenario") ?? "").trim()
    if (!caseId) {
      return { ok: false, message: "", error: "case_id is required", requestId: null }
    }
    if (!title || !scenario) {
      return { ok: false, message: "", error: "title and scenario are required", requestId: null }
    }

    const client = createMoonshotClientFromEnv()
    const admin = await client.issueToken("org_admin", client.config.adminUserId)
    await client.updateCase(admin.access_token, caseId, { title, scenario })

    revalidatePath(`/cases/${caseId}`)
    revalidatePath("/cases")
    return { ok: true, message: `Case updated: ${caseId}`, error: null, requestId: null }
  } catch (error) {
    const parsed = toActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}

export async function generateCaseAction(_prev: CaseActionState, formData: FormData): Promise<CaseActionState> {
  try {
    const caseId = String(formData.get("case_id") ?? "").trim()
    if (!caseId) {
      return { ok: false, message: "", error: "case_id is required", requestId: null }
    }

    const client = createMoonshotClientFromEnv()
    const admin = await client.issueToken("org_admin", client.config.adminUserId)
    const accepted = await client.generateCase(admin.access_token, caseId, `case-generate-${randomUUID()}`)
    revalidatePath(`/cases/${caseId}`)
    revalidatePath("/jobs")
    return { ok: true, message: `Generation job accepted: ${accepted.job_id}`, error: null, requestId: null }
  } catch (error) {
    const parsed = toActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}

export async function reviewTaskFamilyAction(_prev: CaseActionState, formData: FormData): Promise<CaseActionState> {
  try {
    const taskFamilyId = String(formData.get("task_family_id") ?? "").trim()
    if (!taskFamilyId) {
      return { ok: false, message: "", error: "task_family_id is required", requestId: null }
    }

    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)
    await client.reviewTaskFamily(reviewer.access_token, taskFamilyId)
    revalidatePath("/cases")
    return { ok: true, message: `Task family approved: ${taskFamilyId}`, error: null, requestId: null }
  } catch (error) {
    const parsed = toActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}

export async function publishTaskFamilyAction(_prev: CaseActionState, formData: FormData): Promise<CaseActionState> {
  try {
    const taskFamilyId = String(formData.get("task_family_id") ?? "").trim()
    if (!taskFamilyId) {
      return { ok: false, message: "", error: "task_family_id is required", requestId: null }
    }

    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)
    await client.publishTaskFamily(reviewer.access_token, taskFamilyId)
    revalidatePath("/cases")
    return { ok: true, message: `Task family published: ${taskFamilyId}`, error: null, requestId: null }
  } catch (error) {
    const parsed = toActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}
