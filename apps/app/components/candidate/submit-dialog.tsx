"use client"

import { useActionState, useEffect } from "react"
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

const initialSubmitState = { success: false as boolean, error: undefined as string | undefined }
import { toast } from "sonner"

export function SubmitDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { session, finalResponse, setSubmitted } = useSession()
  const [state, formAction, isPending] = useActionState(
    submitSession,
    initialSubmitState
  )

  const isValid = finalResponse.trim().length >= 10

  useEffect(() => {
    if (state.success) {
      setSubmitted(true)
      onOpenChange(false)
      toast.success("Assessment submitted")
    }
  }, [state.success, setSubmitted, onOpenChange])

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
              {finalResponse || "(empty)"}
            </p>
          </div>

          {!isValid && (
            <p className="text-[12px] text-[#FF3B30]">
              Please write a response before submitting.
            </p>
          )}

          {state.error && (
            <p className="text-[12px] text-[#FF3B30]">{state.error}</p>
          )}
        </div>

        <DialogFooter>
          <form action={formAction}>
            <input type="hidden" name="session_id" value={session.id} />
            <input type="hidden" name="final_response" value={finalResponse} />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="h-8 text-[13px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isPending}
                className="h-8 bg-[#0071E3] text-[13px] text-white hover:bg-[#0077ED]"
                aria-label="Confirm"
              >
                {isPending ? <Spinner className="h-3.5 w-3.5" /> : "Confirm"}
              </Button>
            </div>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
