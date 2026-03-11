"use client"

import { useState } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import {
  SessionProvider,
  useSession,
} from "@/components/candidate/session-context"
import { SessionHeader } from "@/components/candidate/session-header"
import { TaskPanel } from "@/components/candidate/task-panel"
import { WorkspacePanel } from "@/components/candidate/workspace-panel"
import { CoachPanel } from "@/components/candidate/coach-panel"
import { SubmitDialog } from "@/components/candidate/submit-dialog"
import { AutoPlayController } from "@/components/candidate/auto-play-controller"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SessionPreflight } from "@/components/candidate/session-preflight"
import { useIsMobile } from "@/hooks/use-mobile"
import type { CandidateSession } from "@/lib/moonshot/types"
import type { DemoFixtureData } from "@/lib/moonshot/demo-fixtures"

type MobileWorkspaceSection = "task" | "work" | "coach"

const MOBILE_SECTIONS: Array<{ value: MobileWorkspaceSection; label: string }> = [
  { value: "task", label: "Task" },
  { value: "work", label: "Work" },
  { value: "coach", label: "Coach" },
]

export function SessionWorkspace({
  session,
  autoPlay = false,
  fixtureData = null,
}: {
  session: CandidateSession
  autoPlay?: boolean
  fixtureData?: DemoFixtureData | null
}) {
  return (
    <SessionProvider session={session} autoPlay={autoPlay} fixtureData={fixtureData}>
      <SessionWorkspaceContent />
    </SessionProvider>
  )
}

function SessionWorkspaceContent() {
  const { isExpired, isSubmitted, session, track, autoPlay, fixtureData } = useSession()
  const [submitOpen, setSubmitOpen] = useState(false)
  const [preflightComplete, setPreflightComplete] = useState(false)
  const [mobileSection, setMobileSection] = useState<MobileWorkspaceSection>("task")
  const isMobile = useIsMobile()

  if (!preflightComplete && session.status !== "submitted" && !autoPlay) {
    return (
      <SessionPreflight
        onReady={() => {
          setPreflightComplete(true)
          track("preflight_completed")
        }}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ops-page-bg,#f5f5f7)]">
      <SessionHeader onSubmit={() => setSubmitOpen(true)} />

      <main className="flex min-h-0 flex-1 flex-col">
        <h1 className="sr-only">Assessment workspace</h1>

        {isMobile ? (
          <>
            <div
              className="sticky top-14 z-40 border-b border-[var(--ops-border,#d7e0e4)] bg-white/92 px-3 py-3 backdrop-blur-xl"
              data-testid="candidate-mobile-section-switcher"
            >
              <div className="mx-auto max-w-4xl">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ops-text-subtle,#64748b)]">
                  Assessment workspace
                </p>
                <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-[var(--ops-surface-subtle,#f8fafc)] p-1">
                  {MOBILE_SECTIONS.map((section) => (
                    <button
                      key={section.value}
                      type="button"
                      aria-pressed={mobileSection === section.value}
                      onClick={() => setMobileSection(section.value)}
                      className={[
                        "min-h-11 rounded-2xl px-3 text-sm font-semibold transition-colors",
                        mobileSection === section.value
                          ? "bg-[var(--ops-accent,#2563eb)] text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)]"
                          : "bg-transparent text-[var(--ops-text-muted,#475569)]",
                      ].join(" ")}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <section
                className={mobileSection === "task" ? "flex h-full min-h-0 flex-col" : "hidden"}
                aria-label="Task panel"
              >
                <TaskPanel />
              </section>
              <section
                className={mobileSection === "work" ? "flex h-full min-h-0 flex-col" : "hidden"}
                aria-label="Work panel"
              >
                <WorkspacePanel />
              </section>
              <section
                className={mobileSection === "coach" ? "flex h-full min-h-0 flex-col" : "hidden"}
                aria-label="Coach panel"
              >
                <CoachPanel />
              </section>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1" data-testid="candidate-desktop-panels">
            <ResizablePanelGroup
              orientation="horizontal"
              className="flex-1"
            >
              <ResizablePanel defaultSize={20} minSize={15} collapsible>
                <TaskPanel />
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={55} minSize={30}>
                <WorkspacePanel />
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={25} minSize={15} collapsible>
                <CoachPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </main>

      <SubmitDialog open={submitOpen} onOpenChange={setSubmitOpen} />

      <Dialog
        open={isExpired && !isSubmitted}
        onOpenChange={() => {}}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Session time limit reached</DialogTitle>
            <DialogDescription>
              The assessment timer expired. Editing and tool interactions are now locked.
              Submit your final response to finish.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              className="h-11 bg-[var(--ops-accent,#2563eb)] text-white hover:bg-[var(--ops-accent-strong,#1d4ed8)] md:h-8"
              onClick={() => setSubmitOpen(true)}
            >
              Review & Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {autoPlay && fixtureData && (
        <AutoPlayController fixture={fixtureData} />
      )}
    </div>
  )
}
