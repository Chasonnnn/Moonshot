import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value.trim()
}

function secret(): string {
  return requiredEnv("MOONSHOT_SESSION_BINDING_SECRET")
}

export function signSessionBinding(sessionId: string): string {
  return createHmac("sha256", secret()).update(sessionId).digest("hex")
}

export function verifySessionBinding(sessionId: string, signature: string): boolean {
  const expected = signSessionBinding(sessionId)
  const expectedBuffer = Buffer.from(expected, "utf8")
  const actualBuffer = Buffer.from(signature, "utf8")
  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }
  return timingSafeEqual(expectedBuffer, actualBuffer)
}
