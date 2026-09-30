import { useState } from "react";

const {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} = require("@tanstack/react-table");

export default function DataTable({
  columns,
  data,
  searchPlaceholder = "Filter rows",
  showSearch = true,
  pageSize = 6,
  fillHeight = false,
  onRowClick,
}) {
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getRowId: (row, index) => String(row.id ?? row.email ?? index),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const { pageIndex, pageSize: size } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const start = total === 0 ? 0 : pageIndex * size + 1;
  const end = Math.min((pageIndex + 1) * size, total);

  return (
    <div className={`flex flex-col gap-4 ${fillHeight ? "h-full min-h-[28rem]" : ""}`}>
      {showSearch ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full max-w-sm rounded-2xl border border-white/20 bg-white px-4 py-2.5 text-sm text-brand-navy outline-none placeholder:text-brand-navy/45 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
          />
          <p className="text-xs text-white/50">
            {start}–{end} of {total}
          </p>
        </div>
      ) : null}
      <div className={`overflow-x-auto ${fillHeight ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-medium">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-brand-teal">
                          {{ asc: "↑", desc: "↓" }[header.column.getIsSorted()] ?? ""}
                        </span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-white/8 hover:bg-white/6 ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={(event) => {
                  if (event.target.closest("button, a, input, label")) return;
                  onRowClick?.(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3.5 text-white/85">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-xl border border-white/15 px-3 py-1.5 text-xs disabled:opacity-40"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Prev
        </button>
        <button
          type="button"
          className="rounded-xl border border-white/15 px-3 py-1.5 text-xs disabled:opacity-40"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  );
}
