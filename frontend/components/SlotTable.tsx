"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ForecastSlot } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SlotTableProps {
  slots: ForecastSlot[]
  loading?: boolean
}

type SortField = "startTime" | "actual" | "forecast" | "error" | "errorPercent" | "publishTime"
type SortOrder = "asc" | "desc"

export function SlotTable({ slots, loading }: SlotTableProps) {
  const [isOpen, setIsOpen] = React.useState(true)
  const [sortField, setSortField] = React.useState<SortField>("startTime")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [prevSlotsLength, setPrevSlotsLength] = React.useState(slots.length)
  const pageSize = 24 // 24 hourly rows per page (1 delivery day)

  // Reset page synchronously during render when slots count changes
  if (slots.length !== prevSlotsLength) {
    setPrevSlotsLength(slots.length)
    setCurrentPage(1)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  // Sorted slots
  const sortedSlots = React.useMemo(() => {
    return [...slots].sort((a, b) => {
      let aVal: string | number | null | undefined = a[sortField]
      let bVal: string | number | null | undefined = b[sortField]

      if (sortField === "startTime" || sortField === "publishTime") {
        aVal = typeof aVal === "string" ? new Date(aVal).getTime() : 0
        bVal = typeof bVal === "string" ? new Date(bVal).getTime() : 0
      }

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1
      return 0
    })
  }, [slots, sortField, sortOrder])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedSlots.length / pageSize))
  const paginatedSlots = sortedSlots.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // CSV Export handler
  const handleDownloadCsv = () => {
    if (!slots.length) return

    const headers = [
      "Hour (UTC)",
      "Slot Start (UTC)",
      "Actual (MW)",
      "Forecast (MW)",
      "Error (MW)",
      "Error (%)",
      "Forecast Publish Time (UTC)",
      "Horizon (Hours)",
    ]

    const rows = sortedSlots.map((s) => [
      format(new Date(s.startTime), "HH:00"),
      s.startTime,
      s.actual ?? "",
      s.forecast ?? "MISSING",
      s.error ?? "",
      s.errorPercent !== null && s.errorPercent !== undefined ? `${s.errorPercent}%` : "",
      s.publishTime ?? "NONE",
      s.horizonHours ?? "",
    ])

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `wind_forecast_hourly_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 size-3.5 opacity-40" />
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 size-3.5 text-primary" />
    ) : (
      <ArrowDown className="ml-1 size-3.5 text-primary" />
    )
  }

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-none">
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex cursor-pointer items-center gap-2 select-none" onClick={() => setIsOpen(!isOpen)}>
          <Button variant="ghost" size="icon-xs" className="size-6 p-0">
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span>Hourly Forecast & Slot Details</span>
              <Badge variant="secondary" className="px-2 py-0.5 text-[11px] font-normal">
                {slots.length} hourly slots
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Hourly wind generation actuals, day-ahead cutoff forecasts, and quantified errors
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={slots.length === 0 || loading}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="size-3.5" />
            <span>Download CSV</span>
          </Button>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs hover:bg-muted/40">
                  <TableHead
                    className="w-40 cursor-pointer font-semibold text-foreground select-none"
                    onClick={() => handleSort("startTime")}
                  >
                    <div className="flex items-center">
                      Hour (UTC)
                      {renderSortIndicator("startTime")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer text-right font-semibold text-foreground select-none"
                    onClick={() => handleSort("actual")}
                  >
                    <div className="flex items-center justify-end">
                      Actual (MW)
                      {renderSortIndicator("actual")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer text-right font-semibold text-foreground select-none"
                    onClick={() => handleSort("forecast")}
                  >
                    <div className="flex items-center justify-end">
                      Forecast (MW)
                      {renderSortIndicator("forecast")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer text-right font-semibold text-foreground select-none"
                    onClick={() => handleSort("error")}
                  >
                    <div className="flex items-center justify-end">
                      Error (MW)
                      {renderSortIndicator("error")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer text-right font-semibold text-foreground select-none"
                    onClick={() => handleSort("errorPercent")}
                  >
                    <div className="flex items-center justify-end">
                      Error (%)
                      {renderSortIndicator("errorPercent")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer font-semibold text-foreground select-none"
                    onClick={() => handleSort("publishTime")}
                  >
                    <div className="flex items-center">
                      Forecast Published At
                      {renderSortIndicator("publishTime")}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedSlots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No slot records available for the selected range.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSlots.map((slot, idx) => {
                    const slotDate = new Date(slot.startTime)
                    const isMissing = slot.forecast === null

                    return (
                      <TableRow key={idx} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-medium">
                          {format(slotDate, "d MMM HH:00")}
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums">
                          {slot.actual !== null ? `${slot.actual.toLocaleString()} MW` : "N/A"}
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums">
                          {isMissing ? (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-normal">
                              Missing
                            </Badge>
                          ) : (
                            `${slot.forecast?.toLocaleString()} MW`
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums">
                          {slot.error !== null ? (
                            <span
                              className={cn(
                                slot.error > 0
                                  ? "text-amber-500"
                                  : slot.error < 0
                                  ? "text-blue-500"
                                  : "text-muted-foreground"
                              )}
                            >
                              {slot.error > 0 ? "+" : ""}
                              {slot.error.toLocaleString()} MW
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums">
                          {slot.errorPercent !== null && slot.errorPercent !== undefined ? (
                            <span>
                              {slot.errorPercent > 0 ? "+" : ""}
                              {slot.errorPercent}%
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>

                        <TableCell className="font-mono text-muted-foreground">
                          {slot.publishTime
                            ? format(new Date(slot.publishTime), "d MMM, HH:mm 'UTC'")
                            : "None (< cutoff)"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
              <span>
                Page {currentPage} of {totalPages} ({slots.length} total hourly slots)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-xs"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="size-7"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-2 font-mono text-foreground">{currentPage}</span>
                <Button
                  variant="outline"
                  size="icon-xs"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="size-7"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
