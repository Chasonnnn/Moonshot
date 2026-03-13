export interface PracticeRetryActionState {
  ok: boolean
  message: string
  error: string | null
  requestId: string | null
  practiceUrl: string | null
}

export const INITIAL_PRACTICE_RETRY_ACTION_STATE: PracticeRetryActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
  practiceUrl: null,
}
