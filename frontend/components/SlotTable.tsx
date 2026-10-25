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
import { formatUtcHour, formatUtcDateTime, formatUtcPublishTime } from "@/lib/format"

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
      formatUtcHour(s.startTime),
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
      return <ArrowUpDown className="ml-1 size-3 text-muted-foreground/50" />
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 size-3 text-foreground" />
    ) : (
      <ArrowDown className="ml-1 size-3 text-foreground" />
    )
  }

  if (loading) {
    return (
      <Card className="border-border/80 bg-card shadow-none">
        <CardHeader className="py-4">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-border/80 bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between py-3.5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="-ml-2 flex items-center gap-1.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            <span>Hourly Settlement Slot Ledger</span>
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {slots.length} slots
            </Badge>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={!slots.length}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-0">
          <div className="border-t border-border/80">
            <Table>
              <TableHeader>
                <TableRow className="text-xs hover:bg-transparent">
                  <TableHead
                    className="cursor-pointer select-none font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("startTime")}
                  >
                    <div className="flex items-center">
                      <span>Delivery Slot (UTC)</span>
                      {renderSortIndicator("startTime")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer select-none text-right font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("actual")}
                  >
                    <div className="flex items-center justify-end">
                      <span>Actual (MW)</span>
                      {renderSortIndicator("actual")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer select-none text-right font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("forecast")}
                  >
                    <div className="flex items-center justify-end">
                      <span>Day-Ahead Forecast</span>
                      {renderSortIndicator("forecast")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer select-none text-right font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("error")}
                  >
                    <div className="flex items-center justify-end">
                      <span>Error (F - A)</span>
                      {renderSortIndicator("error")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer select-none text-right font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("errorPercent")}
                  >
                    <div className="flex items-center justify-end">
                      <span>Error %</span>
                      {renderSortIndicator("errorPercent")}
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer select-none font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("publishTime")}
                  >
                    <div className="flex items-center">
                      <span>Forecast Published (UTC)</span>
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
                    const isMissing = slot.forecast === null

                    return (
                      <TableRow key={idx} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-medium">
                          {formatUtcDateTime(slot.startTime)}
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
                            ? formatUtcPublishTime(slot.publishTime)
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
