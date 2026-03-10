"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useSession } from "@/components/candidate/session-context"
import { submitSession } from "@/actions/session"
import { toast } from "sonner"

const initialSubmitState = { success: false as boolean, error: undefined as string | undefined }

export function SubmitDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const {
    api,
    session,
    finalResponse,
    setSubmitted,
    deliverableContent,
    deliverableArtifacts,
    deliverableId,
    setDeliverableId,
    deliverableStatus,
    setDeliverableStatus,
    isOralComplete = true,
    missingOralPromptLabels = [],
    oralRequirement = { required: false, requiredClipTypes: [], weight: 0 },
    oralResponsesError = null,
    oralResponsesLoaded = true,
  } = useSession()
  const [state, formAction, isPending] = useActionState(
    submitSession,
    initialSubmitState
  )
  const [isSyncingDeliverable, setIsSyncingDeliverable] = useState(false)
  const [deliverableError, setDeliverableError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const allowNativeSubmitRef = useRef(false)
  const submissionText = deliverableContent.trim() || finalResponse
  const isValid = submissionText.trim().length >= 10
  const oralCheckBlocked = oralRequirement.required && !oralResponsesLoaded
  const oralComplete = !oralRequirement.required || isOralComplete
  const isReadyToSubmit = isValid && oralComplete && !oralCheckBlocked && !oralResponsesError

  useEffect(() => {
    if (state.success) {
      setSubmitted(true)
      onOpenChange(false)
      toast.success("Assessment submitted")
    }
  }, [state.success, setSubmitted, onOpenChange])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (allowNativeSubmitRef.current) {
      allowNativeSubmitRef.current = false
      return
    }
    event.preventDefault()
    if (!isReadyToSubmit || isPending || isSyncingDeliverable) {
      return
    }

    setDeliverableError(null)
    setIsSyncingDeliverable(true)
    try {
      const reportMarkdown = deliverableContent.trim()
      if (reportMarkdown) {
        let workingId = deliverableId
        if (workingId) {
          const updated = await api.updateDeliverable(
            workingId,
            reportMarkdown,
            deliverableArtifacts
          )
          setDeliverableStatus(updated.status)
        } else {
          const created = await api.createDeliverable(
            reportMarkdown,
            deliverableArtifacts
          )
          workingId = created.id
          setDeliverableId(created.id)
          setDeliverableStatus(created.status)
        }

        if (workingId && deliverableStatus !== "submitted") {
          const submitted = await api.submitDeliverable(workingId)
          setDeliverableStatus(submitted.status)
        }
      }

      allowNativeSubmitRef.current = true
      formRef.current?.requestSubmit()
    } catch (error) {
      setDeliverableError(
        error instanceof Error ? error.message : "Failed to submit deliverable"
      )
    } finally {
      setIsSyncingDeliverable(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit your assessment</DialogTitle>
          <DialogDescription>
            You cannot make changes after submitting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!session.policy.raw_content_opt_in && (
            <p className="rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] px-3 py-2 text-[12px] text-[#86868B]">
              Your written response will not be stored after scoring.
            </p>
          )}

          <div className="rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] p-3">
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wide">
              Your Response
            </p>
            <p className="mt-1 line-clamp-4 text-[13px] text-[#1D1D1F]">
              {submissionText || "(empty)"}
            </p>
          </div>

          {!isValid && (
            <p className="text-[12px] text-[#FF3B30]">
              Please write a response before submitting.
            </p>
          )}
          {!oralComplete && (
            <p className="text-[12px] text-[#FF3B30]">
              Complete the oral-defense clips before submitting: {missingOralPromptLabels.join(", ")}.
            </p>
          )}
          {oralCheckBlocked && (
            <p className="text-[12px] text-[#FF3B30]">
              Oral-defense requirements are still loading. Wait for the oral workspace to finish checking saved clips before submitting.
            </p>
          )}
          {oralResponsesError && (
            <p className="text-[12px] text-[#FF3B30]">{oralResponsesError}</p>
          )}

          {state.error && (
            <p className="text-[12px] text-[#FF3B30]">{state.error}</p>
          )}
          {deliverableError && (
            <p className="text-[12px] text-[#FF3B30]">{deliverableError}</p>
          )}
        </div>

        <DialogFooter>
          <form ref={formRef} action={formAction} onSubmit={handleSubmit}>
            <input type="hidden" name="session_id" value={session.id} />
            <input type="hidden" name="final_response" value={submissionText} />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending || isSyncingDeliverable}
                className="h-8 text-[13px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isReadyToSubmit || isPending || isSyncingDeliverable}
                className="h-8 bg-[#0071E3] text-[13px] text-white hover:bg-[#0077ED]"
                aria-label="Confirm"
              >
                {isPending || isSyncingDeliverable ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  "Confirm"
                )}
              </Button>
            </div>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
