"use client"

import { type ReactNode } from "react"
import Link from "next/link"
import { Loader2Icon } from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/dashboard", active: true },
  { label: "Case Builder", href: "/cases" },
  { label: "Task Families", href: "/task-families" },
  { label: "Pilot Runs", href: "/pilots" },
  { label: "Exports & Governance", href: "/exports" },
]

export function EmployerShell({ children }: { children: ReactNode }) {
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
                  item.active
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
            <div className="flex items-center gap-1.5 text-[12px] text-[#6E6E73]">
              <Loader2Icon className="size-3 animate-spin" />
              <span>Processing</span>
            </div>
            <div className="size-7 rounded-full bg-[#1D1D1F] flex items-center justify-center">
              <span className="text-white text-[11px] font-medium">A</span>
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
