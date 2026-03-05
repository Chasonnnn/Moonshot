import { loadSessionForCandidate } from "@/actions/session"
import { SessionWorkspace } from "@/components/candidate/session-workspace"
import { DEMO_FIXTURES } from "@/lib/moonshot/demo-fixtures"

export const dynamic = "force-dynamic"

function resolveFixtureForSession(templateId: string | undefined): typeof DEMO_FIXTURES[string] | null {
  if (!templateId) {
    return null
  }
  return DEMO_FIXTURES[templateId] ?? null
}

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ autoplay?: string }>
}) {
  const { id } = await params
  const { autoplay } = await searchParams
  const result = await loadSessionForCandidate(id)
  const isAutoPlay = autoplay === "true"

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

  const policyTemplateId = typeof result.session.policy?.demo_template_id === "string"
    ? result.session.policy.demo_template_id
    : undefined
  const fixtureData = resolveFixtureForSession(policyTemplateId)
  if (isAutoPlay && fixtureData === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
        <div className="max-w-md rounded-2xl border border-[#D2D2D7] bg-white p-8 text-center shadow-sm">
          <h1 className="text-[20px] font-semibold text-[#1D1D1F]">
            Demo Fixture Unavailable
          </h1>
          <p className="mt-2 text-[15px] text-[#86868B]">
            Autoplay requires a valid <code className="font-mono text-[13px]">policy.demo_template_id</code>.
          </p>
          <p className="mt-2 text-[13px] text-[#86868B]">
            Current template id: {policyTemplateId ?? "missing"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <SessionWorkspace
      session={result.session}
      autoPlay={isAutoPlay}
      fixtureData={fixtureData}
    />
  )
}
