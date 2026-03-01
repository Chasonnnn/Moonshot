export function generateCsrfToken(): string {
  return crypto.randomUUID()
}

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)moonshot-csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}
