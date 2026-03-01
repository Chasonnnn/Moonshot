import { cookies } from "next/headers"
import { createMoonshotClientFromEnv } from "@/lib/moonshot/client"
import { verifySessionBinding } from "@/lib/moonshot/session-binding"

function requiredBackendBaseUrl(): string {
  const value = process.env.MOONSHOT_API_BASE_URL
  if (!value || !value.trim()) {
    throw new Error("Missing required environment variable: MOONSHOT_API_BASE_URL")
  }
  return value.trim().replace(/\/$/, "")
}

async function proxyRequest(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  let backendBaseUrl: string
  try {
    backendBaseUrl = requiredBackendBaseUrl()
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Missing backend URL"
    return Response.json({ detail }, { status: 500 })
  }
  const jwt = cookieStore.get("moonshot-session")?.value

  if (!jwt) {
    return Response.json({ detail: "No session cookie" }, { status: 401 })
  }

  // CSRF check on mutating methods
  if (request.method === "POST" || request.method === "PATCH" || request.method === "PUT" || request.method === "DELETE") {
    const csrfHeader = request.headers.get("X-CSRF-Token")
    const csrfCookie = cookieStore.get("moonshot-csrf")?.value

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return Response.json({ detail: "CSRF token mismatch" }, { status: 403 })
    }
  }

  // Extract path from URL: /api/candidate/SESSION_ID/rest/of/path -> /v1/sessions/SESSION_ID/rest/of/path
  const url = new URL(request.url)
  const pathSegments = url.pathname.replace("/api/candidate/", "").split("/")
  const sessionId = pathSegments[0]
  const subPath = pathSegments.slice(1).join("/")
  const backendPath = `/v1/sessions/${sessionId}/${subPath}`
  const boundSessionId = cookieStore.get("moonshot-session-id")?.value
  const boundSignature = cookieStore.get("moonshot-session-sig")?.value

  if (!boundSessionId || !boundSignature || !verifySessionBinding(boundSessionId, boundSignature)) {
    return Response.json({ detail: "Session binding is invalid" }, { status: 401 })
  }
  if (boundSessionId !== sessionId) {
    return Response.json({ detail: "Session mismatch" }, { status: 403 })
  }

  const requestId = crypto.randomUUID()

  // Build upstream request
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${jwt}`,
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
  }

  // Forward idempotency key if present
  const idempotencyKey = request.headers.get("Idempotency-Key")
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey
  }

  let body: string | undefined
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text()
    } catch {
      // no body
    }
  }

  let backendResponse = await fetch(`${backendBaseUrl}${backendPath}${url.search}`, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  })

  // Token reissue on 401
  if (backendResponse.status === 401) {
    try {
      const client = createMoonshotClientFromEnv()
      const tokenResp = await client.issueToken("candidate", client.config.candidateUserId)

      // Update the cookie
      cookieStore.set("moonshot-session", tokenResp.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      })

      // Retry with new token
      headers["Authorization"] = `Bearer ${tokenResp.access_token}`
      backendResponse = await fetch(`${backendBaseUrl}${backendPath}${url.search}`, {
        method: request.method,
        headers,
        body,
        cache: "no-store",
      })
    } catch {
      return Response.json({ detail: "Session expired" }, { status: 401 })
    }
  }

  // Pass through the response
  const responseBody = await backendResponse.text()
  return new Response(responseBody, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("Content-Type") ?? "application/json",
      "X-Request-Id": requestId,
    },
  })
}

export async function GET(request: Request) {
  return proxyRequest(request)
}

export async function POST(request: Request) {
  return proxyRequest(request)
}
