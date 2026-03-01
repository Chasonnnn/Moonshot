"use server"

import { revalidatePath } from "next/cache"

import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import { MoonshotApiError, type AdminPolicy, type AuditLogItem, type FairnessSmokeRun, type RedTeamRun } from "@/lib/moonshot/types"

export interface GovernanceSnapshot {
  policy: AdminPolicy | null
  auditVerification:
    | {
        valid: boolean
        checked_entries: number
        error_code?: string | null
        error_detail?: string | null
      }
    | null
  recentAuditLogs: AuditLogItem[]
  redteamRuns: RedTeamRun[]
  fairnessRuns: FairnessSmokeRun[]
  error: string | null
}

export interface GovernanceActionState {
  ok: boolean
  message: string
  error: string | null
  requestId: string | null
}

function parseActionError(error: unknown): { error: string; requestId: string | null } {
  if (error instanceof MoonshotApiError) {
    return { error: `${error.errorCode}: ${error.errorDetail}`, requestId: error.requestId }
  }
  if (error instanceof Error) {
    return { error: error.message, requestId: null }
  }
  return { error: "Unknown error", requestId: null }
}

export async function loadGovernanceSnapshot(): Promise<GovernanceSnapshot> {
  try {
    const client = createMoonshotClientFromEnv()
    const admin = await client.issueToken("org_admin", client.config.adminUserId)

    const [policy, auditVerification, auditLogs, redteam, fairness] = await Promise.all([
      client.getAdminPolicy(admin.access_token),
      client.getAuditChainVerification(admin.access_token),
      client.listAuditLogs(admin.access_token),
      client.listRedteamRuns(admin.access_token, { limit: 10 }),
      client.listFairnessSmokeRuns(admin.access_token, { limit: 10 }),
    ])

    return {
      policy,
      auditVerification,
      recentAuditLogs: auditLogs.items.slice(0, 10),
      redteamRuns: redteam.items,
      fairnessRuns: fairness.items,
      error: null,
    }
  } catch (error) {
    const parsed = parseActionError(error)
    return {
      policy: null,
      auditVerification: null,
      recentAuditLogs: [],
      redteamRuns: [],
      fairnessRuns: [],
      error: `${parsed.error} (request_id=${parsed.requestId ?? "n/a"})`,
    }
  }
}

export async function purgeExpiredDryRunAction(
  _prev: GovernanceActionState,
  _formData: FormData,
): Promise<GovernanceActionState> {
  void _prev
  void _formData
  try {
    const client = createMoonshotClientFromEnv()
    const admin = await client.issueToken("org_admin", client.config.adminUserId)
    const result = await client.purgeExpiredRawContentDryRun(admin.access_token)
    revalidatePath("/governance")
    return {
      ok: true,
      message: `TTL purge dry-run complete: purged_sessions=${result.purged_sessions}`,
      error: null,
      requestId: null,
    }
  } catch (error) {
    const parsed = parseActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}
