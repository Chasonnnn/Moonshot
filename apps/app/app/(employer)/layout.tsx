import { type ReactNode } from "react"
import { loadPilotSnapshot } from "@/actions/pilot"
import { EmployerShell } from "@/components/employer/shell"
import { Toaster } from "@/components/ui/sonner"

export const dynamic = "force-dynamic"

export default async function EmployerLayout({ children }: { children: ReactNode }) {
  const snapshot = await loadPilotSnapshot()
  const jobCount = snapshot.ok ? snapshot.jobCount : 0

  return (
    <EmployerShell jobCount={jobCount}>
      {children}
      <Toaster position="bottom-right" />
    </EmployerShell>
  )
}
