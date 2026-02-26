import { type ReactNode } from "react"
import { EmployerShell } from "@/components/employer/shell"

export default function EmployerLayout({ children }: { children: ReactNode }) {
  return <EmployerShell>{children}</EmployerShell>
}
