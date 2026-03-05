import type { InterpretationView } from "@/lib/moonshot/types"

export interface ReportActionState {
  ok: boolean
  message: string
  error: string | null
  requestId: string | null
  interpretation: InterpretationView | null
}

export const INITIAL_REPORT_ACTION_STATE: ReportActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
  interpretation: null,
}
