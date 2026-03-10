"use client"

import { type ReactNode, useState } from "react"
import Link from "next/link"
import { CheckCircle2Icon, Loader2Icon, MenuIcon, XIcon } from "lucide-react"
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
  const [mobileNavOpenPath, setMobileNavOpenPath] = useState<string | null>(null)
  const mobileNavOpen = mobileNavOpenPath === pathname

  return (
    <div className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#F7F3EA_0%,#F4F7F8_48%,#F8FAFC_100%)]">
      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-[#D7E0E4]/80 bg-[rgba(248,250,252,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-screen-xl min-w-0 items-center gap-3 px-4 md:gap-4 md:px-8">
          {/* Logo */}
          <Link href="/dashboard" className="mr-2 flex min-w-0 shrink items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-2xl bg-[#0F172A] shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
              <span className="text-[11px] font-semibold leading-none text-white">M</span>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[13px] font-semibold tracking-tight text-[#0F172A]">Moonshot</span>
              <span className="hidden text-[10px] uppercase tracking-[0.24em] text-[#64748B] sm:block">Ops room</span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
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
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpenPath((prev) => (prev === pathname ? null : pathname))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[#0F172A] md:hidden"
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="employer-mobile-nav"
              data-testid="mobile-nav-toggle"
            >
              {mobileNavOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
            </button>
            {jobCount > 0 ? (
              <div className="flex items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[12px] text-[#1D4ED8] sm:px-3">
                <Loader2Icon className="size-3 animate-spin" />
                <span className="hidden sm:inline">Processing {jobCount > 1 ? `(${jobCount})` : ""}</span>
                <span className="sm:hidden" aria-hidden="true">{jobCount > 1 ? jobCount : ""}</span>
                <span className="sr-only">Processing {jobCount > 1 ? `(${jobCount})` : ""}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-[#D1FAE5] bg-[#ECFDF5] px-2.5 py-1 text-[12px] text-[#047857] sm:px-3">
                <CheckCircle2Icon className="size-3" />
                <span className="hidden sm:inline">Ready</span>
                <span className="sr-only">Ready</span>
              </div>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={<div className="hidden size-8 cursor-default items-center justify-center rounded-full bg-[#0F172A] sm:flex" />}
                >
                  <span className="text-white text-[11px] font-medium">A</span>
                </TooltipTrigger>
                <TooltipContent>Admin</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {mobileNavOpen ? (
          <div id="employer-mobile-nav" className="border-t border-[#E2E8F0] bg-[rgba(248,250,252,0.96)] px-4 py-3 md:hidden">
            <nav className="grid gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileNavOpenPath(null)}
                  className={[
                    "rounded-2xl px-3 py-3 text-[13px] font-medium transition-colors",
                    isNavActive(pathname, item.href)
                      ? "bg-[#1D1D1F] text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)]"
                      : "bg-white text-[#0F172A]",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </header>

      {children}
    </div>
  )
}
