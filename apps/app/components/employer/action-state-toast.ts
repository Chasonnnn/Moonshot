"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

export interface ActionToastState {
  ok: boolean
  message: string
  error: string | null
  requestId: string | null
}

export function formatActionErrorForToast(error: string, requestId: string | null): string {
  if (!requestId) {
    return error
  }
  return `${error} (request_id=${requestId})`
}

export function useActionStateToast(state: ActionToastState): void {
  const prevState = useRef(state)

  useEffect(() => {
    if (state === prevState.current) {
      return
    }

    prevState.current = state

    if (state.ok) {
      toast.success(state.message)
      return
    }
    if (state.error) {
      toast.error(formatActionErrorForToast(state.error, state.requestId))
    }
  }, [state])
}
