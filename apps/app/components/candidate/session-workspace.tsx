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
import type { CandidateSession } from "@/lib/moonshot/types"
import type { DemoFixtureData } from "@/lib/moonshot/demo-fixtures"

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
    <div className="flex h-screen flex-col bg-[#F5F5F7]">
      <SessionHeader onSubmit={() => setSubmitOpen(true)} />

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
              className="h-8 bg-[#0071E3] text-white hover:bg-[#0077ED]"
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
