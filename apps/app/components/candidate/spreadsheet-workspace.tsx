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
      <div className="flex h-full items-center justify-center bg-[#F8FAFC] text-[13px] text-[#64748B]">
        Spreadsheet view is not configured for this simulation.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      <div className="border-b border-[#E2E8F0] bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Spreadsheet</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#0F172A]">{workbook.workbookName}</h3>
            <p className="text-[12px] text-[#475569]">Formula focus: {workbook.formulaSummary.join(" · ")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {workbook.sheets.map((item, index) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setActiveSheet(index)}
                className={[
                  "rounded-full border px-3 py-1 text-[12px] font-medium",
                  index === activeSheet
                    ? "border-[#2563EB] bg-[#DBEAFE] text-[#1D4ED8]"
                    : "border-[#CBD5E1] bg-white text-[#475569]",
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
          <div className="mb-4 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-[12px] leading-relaxed text-[#1E3A8A]">
            {sheet.note}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[24px] border border-[#D7E0E4] bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-[12px] text-[#0F172A]">
            <thead className="bg-[#F8FAFC]">
              <tr>
                {sheet.columns.map((column) => (
                  <th key={column} className="border-b border-[#E2E8F0] px-3 py-2 font-semibold text-[#475569]">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, rowIndex) => (
                <tr key={`${sheet.name}-${rowIndex}`} className="even:bg-[#FCFDFE]">
                  {row.map((value, columnIndex) => {
                    const cellId = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 2}`
                    const isHighlighted = sheet.highlightedCells?.includes(cellId)
                    return (
                      <td
                        key={cellId}
                        className={[
                          "border-b border-[#EDF2F7] px-3 py-2 align-top",
                          isHighlighted ? "bg-[#DCFCE7] font-semibold text-[#166534]" : "",
                        ].join(" ")}
                      >
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[#94A3B8]">{cellId}</div>
                        <div className="mt-1">{value}</div>
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
