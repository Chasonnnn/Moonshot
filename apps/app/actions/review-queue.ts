"use server"

import { revalidatePath } from "next/cache"

import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import { MoonshotApiError, type ReviewQueueItem } from "@/lib/moonshot/types"

export interface ReviewQueueSnapshot {
  items: ReviewQueueItem[]
  error: string | null
}

export interface ReviewQueueActionState {
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

export async function loadReviewQueueSnapshot(): Promise<ReviewQueueSnapshot> {
  try {
    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)
    const queue = await client.listReviewQueue(reviewer.access_token, false)
    return { items: queue.items, error: null }
  } catch (error) {
    const parsed = parseActionError(error)
    return { items: [], error: `${parsed.error} (request_id=${parsed.requestId ?? "n/a"})` }
  }
}

export async function resolveReviewQueueAction(
  _prev: ReviewQueueActionState,
  formData: FormData,
): Promise<ReviewQueueActionState> {
  try {
    const sessionId = String(formData.get("session_id") ?? "").trim()
    const decision = String(formData.get("decision") ?? "").trim().toLowerCase()
    const reviewerNote = String(formData.get("reviewer_note") ?? "").trim()

    if (!sessionId) {
      return { ok: false, message: "", error: "session_id is required", requestId: null }
    }
    if (decision !== "approved" && decision !== "rejected") {
      return { ok: false, message: "", error: "decision must be approved or rejected", requestId: null }
    }

    const client = createMoonshotClientFromEnv()
    const reviewer = await client.issueToken("reviewer", client.config.reviewerUserId)
    await client.resolveReviewQueueItem(reviewer.access_token, sessionId, {
      decision,
      reviewer_note: reviewerNote || undefined,
    })

    revalidatePath("/review-queue")
    return { ok: true, message: `Review queue resolved: ${sessionId}`, error: null, requestId: null }
  } catch (error) {
    const parsed = parseActionError(error)
    return { ok: false, message: "", error: parsed.error, requestId: parsed.requestId }
  }
}
