"use client"

import { type ReactNode } from "react"
import Link from "next/link"
import { CheckCircle2Icon, Loader2Icon } from "lucide-react"
import { usePathname } from "next/navigation"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Demo Console", href: "/demo" },
  { label: "Cases", href: "/cases" },
  { label: "Review Queue", href: "/review-queue" },
  { label: "Governance", href: "/governance" },
  { label: "Pilot Runs", href: "/pilots" },
]

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

export function EmployerShell({
  children,
  jobCount = 0,
}: {
  children: ReactNode
  jobCount?: number
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Top navigation */}
      <header className="sticky top-0 z-50 h-12 bg-[rgba(255,255,255,0.82)] backdrop-blur-xl border-b border-[#D2D2D7]/60">
        <div className="max-w-screen-xl mx-auto px-8 h-full flex items-center gap-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
            <div className="size-5 rounded bg-[#1D1D1F] flex items-center justify-center">
              <span className="text-white text-[10px] font-semibold leading-none">M</span>
            </div>
            <span className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight">
              Moonshot
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5 flex-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={[
                  "px-3 py-1.5 text-[13px] rounded-md transition-colors",
                  isNavActive(pathname, item.href)
                    ? "bg-[#1D1D1F] text-white font-medium"
                    : "text-[#1D1D1F] hover:bg-[#1D1D1F]/8",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: job indicator + avatar */}
          <div className="flex items-center gap-4 shrink-0">
            {jobCount > 0 ? (
              <div className="flex items-center gap-1.5 text-[12px] text-[#6E6E73]">
                <Loader2Icon className="size-3 animate-spin" />
                <span>Processing {jobCount > 1 ? `(${jobCount})` : ""}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[12px] text-[#34C759]">
                <CheckCircle2Icon className="size-3" />
                <span>Ready</span>
              </div>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={<div className="size-7 rounded-full bg-[#1D1D1F] flex items-center justify-center cursor-default" />}
                >
                  <span className="text-white text-[11px] font-medium">A</span>
                </TooltipTrigger>
                <TooltipContent>Admin</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
