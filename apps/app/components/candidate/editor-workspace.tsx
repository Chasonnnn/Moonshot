"use client"

import { useState, useCallback, useMemo } from "react"
import { FileText, Image } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { useSession } from "@/components/candidate/session-context"

const SECTION_TEMPLATES = [
  { label: "Executive Summary", markdown: "## Executive Summary\n\n" },
  { label: "Analysis", markdown: "## Analysis\n\n" },
  { label: "Findings", markdown: "## Key Findings\n\n" },
  { label: "Recommendations", markdown: "## Recommendations\n\n" },
  { label: "Trade-offs & Risks", markdown: "## Trade-offs & Risks\n\n" },
]

export function EditorWorkspace() {
  const {
    api,
    isSubmitted,
    isExpired,
    deliverableContent,
    setDeliverableContent,
    deliverableArtifacts,
    deliverableId,
    setDeliverableId,
    setDeliverableStatus,
    track,
  } = useSession()
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const wordCount = useMemo(() => {
    const trimmed = deliverableContent.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
  }, [deliverableContent])

  const insertSection = useCallback(
    (markdown: string) => {
      setDeliverableContent((prev) => prev + markdown)
    },
    [setDeliverableContent]
  )

  const disabled = isSubmitted || isExpired
  const saveDraft = useCallback(async () => {
    if (disabled) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const payload = deliverableContent.trim()
      if (!payload) {
        setIsSaving(false)
        return
      }
      if (deliverableId) {
        const updated = await api.updateDeliverable(
          deliverableId,
          payload,
          deliverableArtifacts
        )
        setDeliverableStatus(updated.status)
      } else {
        const created = await api.createDeliverable(payload, deliverableArtifacts)
        setDeliverableId(created.id)
        setDeliverableStatus(created.status)
      }
      track("deliverable_draft_saved", { chars: payload.length })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save draft")
    } finally {
      setIsSaving(false)
    }
  }, [
    api,
    deliverableArtifacts,
    deliverableContent,
    deliverableId,
    disabled,
    setDeliverableId,
    setDeliverableStatus,
    track,
  ])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[#D2D2D7] px-3 py-1.5">
        <FileText className="h-3.5 w-3.5 text-[#86868B]" />
        <span className="text-[12px] font-medium text-[#1D1D1F]">Report Editor</span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || isSaving || !deliverableContent.trim()}
          onClick={saveDraft}
          className="h-6 text-[11px] text-[#0071E3] hover:text-[#0058B8]"
        >
          {isSaving ? "Saving..." : "Save Draft"}
        </Button>
        {SECTION_TEMPLATES.map((tpl) => (
          <Button
            key={tpl.label}
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => insertSection(tpl.markdown)}
            className="h-6 text-[11px] text-[#86868B] hover:text-[#1D1D1F]"
          >
            {tpl.label}
          </Button>
        ))}
      </div>

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={30}>
          <textarea
            value={deliverableContent}
            onChange={(e) => setDeliverableContent(e.target.value)}
            disabled={disabled}
            placeholder="Write your report here using Markdown..."
            className="h-full w-full resize-none bg-white p-4 font-mono text-[13px] text-[#1D1D1F] outline-none placeholder:text-[#86868B]"
            spellCheck={false}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={30}>
          <ScrollArea className="h-full">
            <div className="p-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#86868B]">
                Preview
              </p>
              <Separator />
              <div className="prose prose-sm mt-3 max-w-none text-[#1D1D1F]">
                <MarkdownPreview content={deliverableContent} />
              </div>
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="flex items-center gap-3 border-t border-[#D2D2D7] px-3 py-1">
        <span className="text-[11px] text-[#86868B]">{wordCount} words</span>
        <span className="text-[11px] text-[#86868B]">{deliverableContent.length} characters</span>
        {saveError && (
          <span className="text-[11px] text-[#FF3B30]">{saveError}</span>
        )}
      </div>
    </div>
  )
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <p className="text-[13px] text-[#86868B]">
        Your report preview will appear here...
      </p>
    )
  }

  const lines = content.split("\n")
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="mt-4 text-[16px] font-semibold text-[#1D1D1F]">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="mt-4 text-[18px] font-bold text-[#1D1D1F]">
          {line.slice(2)}
        </h1>
      )
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="mt-3 text-[14px] font-semibold text-[#1D1D1F]">
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="ml-4 text-[13px] text-[#1D1D1F]">
          {line.slice(2)}
        </li>
      )
    } else if (line.startsWith("![")) {
      const match = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      if (match) {
        elements.push(
          <div key={i} className="my-2 flex items-center gap-2 rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] p-2">
            <Image className="h-4 w-4 text-[#0071E3]" />
            <span className="text-[12px] text-[#86868B]">Chart: {match[1] || "embedded"}</span>
          </div>
        )
      }
    } else if (line.trim() === "") {
      elements.push(<br key={i} />)
    } else {
      elements.push(
        <p key={i} className="text-[13px] leading-relaxed text-[#1D1D1F]">
          {line}
        </p>
      )
    }
  }

  return <>{elements}</>
}
