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
  { label: "Work Simulations", href: "/demo" },
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#F7F3EA_0%,#F4F7F8_48%,#F8FAFC_100%)]">
      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-[#D7E0E4]/80 bg-[rgba(248,250,252,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-6 px-6 md:px-8">
          {/* Logo */}
          <Link href="/dashboard" className="mr-2 flex shrink-0 items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-2xl bg-[#0F172A] shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
              <span className="text-[11px] font-semibold leading-none text-white">M</span>
            </div>
            <div>
              <span className="block text-[13px] font-semibold tracking-tight text-[#0F172A]">Moonshot</span>
              <span className="block text-[10px] uppercase tracking-[0.24em] text-[#64748B]">Ops room</span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={[
                  "rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
                  isNavActive(pathname, item.href)
                    ? "bg-[#1D1D1F] text-white font-medium shadow-[0_10px_20px_rgba(15,23,42,0.16)]"
                    : "text-[#1D1D1F] hover:bg-white hover:text-[#0F172A]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: job indicator + avatar */}
          <div className="flex shrink-0 items-center gap-4">
            {jobCount > 0 ? (
              <div className="flex items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-[12px] text-[#1D4ED8]">
                <Loader2Icon className="size-3 animate-spin" />
                <span>Processing {jobCount > 1 ? `(${jobCount})` : ""}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-[#D1FAE5] bg-[#ECFDF5] px-3 py-1 text-[12px] text-[#047857]">
                <CheckCircle2Icon className="size-3" />
                <span>Ready</span>
              </div>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={<div className="flex size-8 cursor-default items-center justify-center rounded-full bg-[#0F172A]" />}
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
