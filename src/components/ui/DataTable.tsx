'use client'

import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableColumn<T> = ColumnDef<T, any>

interface DataTableProps<T> {
  data: T[]
  columns: TableColumn<T>[]
  searchPlaceholder?: string
  emptyMessage?: string
  /** Renders above the table — use for action buttons */
  toolbar?: React.ReactNode
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No records found.',
  toolbar,
}: DataTableProps<T>) {
  const [sorting, setSorting]         = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')

  const table = useReactTable({
    data,
    columns,
    state:   { sorting, globalFilter },
    onSortingChange:      setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel:      getCoreRowModel(),
    getSortedRowModel:    getSortedRowModel(),
    getFilteredRowModel:  getFilteredRowModel(),
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: search + any extra action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              'h-9 w-56 rounded border border-neutral-300 bg-white pl-8 pr-3 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary-500',
            )}
          />
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="flex items-center gap-1 hover:text-neutral-800 transition-colors"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc:  <ChevronUp   className="h-3 w-3" />,
                            desc: <ChevronDown className="h-3 w-3" />,
                          }[header.column.getIsSorted() as string] ?? (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm text-neutral-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-neutral-50/60">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-neutral-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count */}
      <p className="text-xs text-neutral-400">
        {table.getFilteredRowModel().rows.length} of {data.length} records
      </p>
    </div>
  )
}
