"use client"

import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--ops-surface)",
          "--normal-text": "var(--ops-text)",
          "--normal-border": "var(--ops-border-soft)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast border border-[var(--ops-border-soft)] bg-[var(--ops-surface)] text-[var(--ops-text)] shadow-[var(--ops-shadow-sm)]",
          title: "text-[13px] font-semibold text-[var(--ops-text)]",
          description: "text-[12px] text-[var(--ops-text-muted)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
