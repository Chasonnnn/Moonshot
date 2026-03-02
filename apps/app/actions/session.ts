"use server"

import { cookies } from "next/headers"
import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import { verifySessionBinding } from "@/lib/moonshot/session-binding"
import type { CandidateSession } from "@/lib/moonshot/types"

export interface LoadSessionResult {
  session?: CandidateSession
  error?: string
}

export async function loadSessionForCandidate(sessionId: string): Promise<LoadSessionResult> {
  try {
    const cookieStore = await cookies()
    const boundSessionId = cookieStore.get("moonshot-session-id")?.value
    const boundSignature = cookieStore.get("moonshot-session-sig")?.value
    if (!boundSessionId || !boundSignature || !verifySessionBinding(boundSessionId, boundSignature)) {
      return { error: "Session bootstrap missing or invalid. Open the candidate handoff link again." }
    }
    if (boundSessionId !== sessionId) {
      return { error: "Session mismatch. Open the candidate handoff link for this session." }
    }

    const jwt = cookieStore.get("moonshot-session")?.value
    if (!jwt) {
      return { error: "Session token missing. Open the candidate handoff link again." }
    }

    const client = createMoonshotClientFromEnv()
    const response = await fetch(
      `${client.config.baseUrl}/v1/sessions/${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      return { error: body.detail ?? `Failed to load session (${response.status})` }
    }

    const session = (await response.json()) as CandidateSession
    if (!session.task_prompt || !session.task_prompt.trim()) {
      return { error: "Session task prompt unavailable." }
    }

    return { session }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error loading session"
    return { error: message }
  }
}

export interface SubmitSessionState {
  success: boolean
  error?: string
}

export async function submitSession(
  prevState: SubmitSessionState,
  formData: FormData
): Promise<SubmitSessionState> {
  const sessionId = formData.get("session_id") as string
  const finalResponse = formData.get("final_response") as string

  if (!finalResponse || finalResponse.trim().length < 10) {
    return { success: false, error: "Please write a response before submitting." }
  }

  try {
    const cookieStore = await cookies()
    const boundSessionId = cookieStore.get("moonshot-session-id")?.value
    const boundSignature = cookieStore.get("moonshot-session-sig")?.value
    if (!boundSessionId || !boundSignature || !verifySessionBinding(boundSessionId, boundSignature)) {
      return { success: false, error: "Session binding is invalid. Please reload the page." }
    }
    if (boundSessionId !== sessionId) {
      return { success: false, error: "Session mismatch. Please reload the page." }
    }

    let jwt = cookieStore.get("moonshot-session")?.value

    if (!jwt) {
      // Try to reissue
      try {
        const client = createMoonshotClientFromEnv()
        const tokenResp = await client.issueToken("candidate", client.config.candidateUserId)
        jwt = tokenResp.access_token

        cookieStore.set("moonshot-session", jwt, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 3600,
        })
      } catch {
        return { success: false, error: "Session expired. Please reload the page." }
      }
    }

    const client = createMoonshotClientFromEnv()
    const response = await fetch(
      `${client.config.baseUrl}/v1/sessions/${sessionId}/submit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ final_response: finalResponse }),
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      return { success: false, error: body.detail ?? `Submit failed (${response.status})` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}
