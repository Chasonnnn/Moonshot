import { NextResponse } from "next/server"

import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import { generateCsrfToken } from "@/lib/moonshot/csrf"
import { signSessionBinding } from "@/lib/moonshot/session-binding"
import type { CandidateSession } from "@/lib/moonshot/types"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  try {
    const client = createMoonshotClientFromEnv()
    const tokenResp = await client.issueToken("candidate", client.config.candidateUserId)

    const sessionResponse = await fetch(
      `${client.config.baseUrl}/v1/sessions/${id}`,
      {
        headers: {
          Authorization: `Bearer ${tokenResp.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    )

    if (!sessionResponse.ok) {
      const body = await sessionResponse.json().catch(() => ({}))
      return NextResponse.json(
        { detail: body.detail ?? `Failed to load session (${sessionResponse.status})` },
        { status: sessionResponse.status },
      )
    }

    const session = (await sessionResponse.json()) as CandidateSession
    if (!session.task_prompt || !session.task_prompt.trim()) {
      return NextResponse.json(
        { detail: "Session task prompt unavailable." },
        { status: 500 },
      )
    }

    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
    if (!host) {
      return NextResponse.json({ detail: "Missing host header for session bootstrap redirect." }, { status: 500 })
    }
    const proto = request.headers.get("x-forwarded-proto") ?? "http"
    const redirect = NextResponse.redirect(new URL(`/session/${id}`, `${proto}://${host}`))
    redirect.cookies.set("moonshot-session", tokenResp.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    })
    redirect.cookies.set("moonshot-session-id", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    })
    redirect.cookies.set("moonshot-session-sig", signSessionBinding(session.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    })
    redirect.cookies.set("moonshot-csrf", generateCsrfToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    })
    return redirect
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown bootstrap error"
    return NextResponse.json({ detail }, { status: 500 })
  }
}
