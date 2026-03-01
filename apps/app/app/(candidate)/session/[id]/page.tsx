import { loadSessionForCandidate } from "@/actions/session"
import { SessionWorkspace } from "@/components/candidate/session-workspace"

export const dynamic = "force-dynamic"

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await loadSessionForCandidate(id)

  if (result.error || !result.session) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
        <div className="max-w-md rounded-2xl border border-[#D2D2D7] bg-white p-8 text-center shadow-sm">
          <h1 className="text-[20px] font-semibold text-[#1D1D1F]">
            Session Unavailable
          </h1>
          <p className="mt-2 text-[15px] text-[#86868B]">
            {result.error ?? "This session could not be loaded."}
          </p>
        </div>
      </div>
    )
  }

  return <SessionWorkspace session={result.session} />
}
