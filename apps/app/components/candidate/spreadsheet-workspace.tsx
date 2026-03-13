"use client"

import { useMemo, useState } from "react"
import { useSession } from "@/components/candidate/session-context"

export function SpreadsheetWorkspace() {
  const { activeTemplate, currentRoundIndex, fixtureData } = useSession()
  const workbook = useMemo(() => {
    if (fixtureData?.spreadsheetWorkspace) {
      return fixtureData.spreadsheetWorkspace
    }
    if (fixtureData?.datasets.length) {
      const artifactName =
        activeTemplate?.artifacts.find((artifact) => artifact.type === "xlsx" || artifact.type === "spreadsheet")?.name ??
        "simulation_workbook.xlsx"
      return {
        workbookName: artifactName,
        formulaSummary: [
          fixtureData.rounds[currentRoundIndex]?.objective ?? "Current round objective",
          "Workbook preview synthesized from fixture datasets.",
        ],
        sheets: fixtureData.datasets.slice(0, 3).map((dataset) => {
          const columns = dataset.schema.columns.map((column) => column.name)
          return {
            name: dataset.name,
            columns,
            rows: dataset.preview_rows.slice(0, 8).map((row) =>
              columns.map((column) => {
                const value = row[column]
                if (value == null) {
                  return ""
                }
                return typeof value === "string" ? value : JSON.stringify(value)
              })
            ),
            note: dataset.description,
          }
        }),
      }
    }
    const spreadsheetActions =
      fixtureData?.rounds.flatMap((round) =>
        (round.toolActions ?? []).filter((action) => action.tool === "spreadsheet")
      ) ?? []
    if (spreadsheetActions.length === 0) {
      return null
    }
    return {
      workbookName: "Simulation workbook",
      formulaSummary: spreadsheetActions.map((action) => action.label),
      sheets: spreadsheetActions.map((action, index) => ({
        name: `Sheet ${index + 1}`,
        columns: ["View", "Detail", "Artifacts"],
        rows: [[action.label, action.detail ?? action.action ?? "", (action.artifactRefs ?? []).join(", ")]],
        note: action.prompt,
      })),
    }
  }, [activeTemplate?.artifacts, currentRoundIndex, fixtureData])
  const [activeSheet, setActiveSheet] = useState(0)

  const sheet = useMemo(() => {
    if (!workbook || workbook.sheets.length === 0) {
      return null
    }
    return workbook.sheets[Math.min(activeSheet, workbook.sheets.length - 1)]
  }, [activeSheet, workbook])

  if (!workbook || !sheet) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--ops-surface-muted)] text-[13px] text-[var(--ops-text-subtle)]">
        Spreadsheet view is not configured for this simulation.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--ops-surface-muted)]">
      <div className="border-b border-[var(--ops-border)] bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--ops-text)]">{workbook.workbookName}</h3>
            <p className="text-[12px] text-[var(--ops-text-muted)]">{workbook.formulaSummary.join(" · ")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {workbook.sheets.map((item, index) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setActiveSheet(index)}
                className={[
                  "min-h-10 rounded-full border px-4 py-2 text-[13px] font-medium md:min-h-8 md:px-3 md:py-1 md:text-[12px]",
                  index === activeSheet
                    ? "border-[var(--ops-accent)] bg-[var(--ops-accent-soft)] text-[var(--ops-accent-strong)]"
                    : "border-[var(--ops-border-strong)] bg-white text-[var(--ops-text-muted)]",
                ].join(" ")}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {sheet.note ? (
          <div className="mb-4 rounded-2xl border border-[var(--ops-accent-soft)] bg-[var(--ops-accent-soft)]/40 px-4 py-3 text-[12px] leading-relaxed text-[var(--ops-accent-strong)]">
            {sheet.note}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-[var(--ops-border)] bg-white">
          <table className="min-w-full border-collapse text-left text-[12px] text-[var(--ops-text)]">
            <thead className="bg-[var(--ops-surface-muted)]">
              <tr>
                {sheet.columns.map((column) => (
                  <th key={column} className="border-b border-[var(--ops-border)] px-3 py-2 font-semibold text-[var(--ops-text-muted)]">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, rowIndex) => (
                <tr key={`${sheet.name}-${rowIndex}`} className="even:bg-[var(--ops-surface-muted)]/50">
                  {row.map((value, columnIndex) => {
                    const cellId = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 2}`
                    const isHighlighted = sheet.highlightedCells?.includes(cellId)
                    return (
                      <td
                        key={cellId}
                        className={[
                          "border-b border-[var(--ops-border)]/50 px-3 py-2",
                          isHighlighted ? "bg-[var(--ops-success-soft)] font-semibold text-[var(--ops-success)]" : "",
                        ].join(" ")}
                      >
                        {value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
