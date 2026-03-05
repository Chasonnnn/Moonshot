"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SqlWorkspace } from "@/components/candidate/sql-workspace"
import { AnalysisWorkspace } from "@/components/candidate/python-workspace"
import { DashboardWorkspace } from "@/components/candidate/dashboard-workspace"
import { DataWorkspace, type CaseDatasetView } from "@/components/candidate/data-workspace"
import { EditorWorkspace } from "@/components/candidate/editor-workspace"
import { useSession } from "@/components/candidate/session-context"
import type { CaseDataset } from "@/lib/moonshot/types"

function normalizeDataset(dataset: CaseDataset): CaseDatasetView {
  return {
    id: dataset.id ?? dataset.name,
    name: dataset.name,
    description: dataset.description ?? "",
    row_count: dataset.row_count ?? 0,
    schema: {
      columns: dataset.schema?.columns ?? dataset.columns ?? [],
    },
    preview_rows: dataset.preview_rows ?? [],
  }
}

export function WorkspacePanel() {
  const { api, fixtureData } = useSession()
  const [runtimeDatasets, setRuntimeDatasets] = useState<CaseDatasetView[]>([])

  useEffect(() => {
    let cancelled = false
    const loadDatasets = async () => {
      try {
        const response = await api.getDatasets()
        if (!cancelled) {
          const baseDatasets = response.datasets.map(normalizeDataset)
          const enriched = await Promise.all(
            baseDatasets.map(async (dataset) => {
              if (dataset.preview_rows.length > 0) return dataset
              try {
                const preview = await api.getDatasetPreview(dataset.name)
                const previewColumns = dataset.schema.columns.length
                  ? dataset.schema.columns
                  : preview.columns.map((name) => ({
                      name,
                      dtype: "unknown",
                      description: "",
                      sample_values: [],
                    }))
                return {
                  ...dataset,
                  schema: { columns: previewColumns },
                  preview_rows: preview.rows,
                }
              } catch {
                return dataset
              }
            })
          )
          if (!cancelled) {
            setRuntimeDatasets(enriched)
          }
        }
      } catch {
        if (!cancelled) {
          setRuntimeDatasets([])
        }
      }
    }
    void loadDatasets()
    return () => {
      cancelled = true
    }
  }, [api])

  const datasets = useMemo(
    () => (runtimeDatasets.length > 0 ? runtimeDatasets : fixtureData?.datasets ?? []),
    [fixtureData?.datasets, runtimeDatasets]
  )

  return (
    <Tabs defaultValue="data" className="flex h-full flex-col">
      <TabsList className="mx-3 mt-2 h-8 w-fit">
        <TabsTrigger value="data" className="text-[12px]">
          Data
        </TabsTrigger>
        <TabsTrigger value="sql" className="text-[12px]">
          SQL
        </TabsTrigger>
        <TabsTrigger value="python" className="text-[12px]">
          Analysis
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="text-[12px]">
          Dashboard
        </TabsTrigger>
        <TabsTrigger value="report" className="text-[12px]">
          Report
        </TabsTrigger>
      </TabsList>
      <TabsContent value="data" className="mt-0 flex-1 overflow-hidden">
        <DataWorkspace datasets={datasets} />
      </TabsContent>
      <TabsContent value="sql" className="mt-0 flex-1 overflow-hidden">
        <SqlWorkspace />
      </TabsContent>
      <TabsContent value="python" className="mt-0 flex-1 overflow-hidden">
        <AnalysisWorkspace />
      </TabsContent>
      <TabsContent value="dashboard" className="mt-0 flex-1 overflow-hidden">
        <DashboardWorkspace />
      </TabsContent>
      <TabsContent value="report" className="mt-0 flex-1 overflow-hidden">
        <EditorWorkspace />
      </TabsContent>
    </Tabs>
  )
}
