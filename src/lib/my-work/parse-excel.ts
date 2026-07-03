import * as XLSX from 'xlsx'
import type { WorkSheetRow } from './types'

function normalizeColumns(raw: string[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((name, i) => {
    const base = (name || '').trim() || `Column ${i + 1}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base} (${count + 1})`
  })
}

function newRowId(): string {
  return crypto.randomUUID()
}

/** Parse first worksheet from an Excel file into columns + rows. */
export function parseExcelBuffer(buffer: ArrayBuffer): {
  columns: string[]
  rows:    WorkSheetRow[]
} {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { columns: ['Notes'], rows: [] }
  }

  const sheet = workbook.Sheets[sheetName]
  const grid  = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    { header: 1, defval: '' },
  )

  if (!grid.length) {
    return { columns: ['Notes'], rows: [] }
  }

  const headerRow = (grid[0] ?? []).map(c => String(c ?? ''))
  const columns   = normalizeColumns(headerRow)

  const rows: WorkSheetRow[] = []
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] ?? []
    const cells: Record<string, string> = {}
    let hasValue = false

    columns.forEach((col, i) => {
      const val = String(line[i] ?? '').trim()
      cells[col] = val
      if (val) hasValue = true
    })

    if (!hasValue) continue

    rows.push({
      id:        newRowId(),
      cells,
      tactic_id: null,
    })
  }

  return { columns, rows }
}
