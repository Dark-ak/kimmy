"use client"

import * as React from "react"
import { format, isBefore, isAfter } from "date-fns"
import { AlertCircle, RefreshCw, CalendarX } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/Header"
import { ControlsBar } from "@/components/ControlsBar"
import { TakeawayAlert } from "@/components/TakeawayAlert"
import { KpiCards } from "@/components/KpiCards"
import { ForecastChart } from "@/components/ForecastChart"
import { ErrorByHourChart } from "@/components/ErrorByHourChart"
import { ErrorByHorizonChart } from "@/components/ErrorByHorizonChart"
import { SlotTable } from "@/components/SlotTable"

import {
  fetchConfig,
  fetchForecast,
  fetchForecastRange,
  fetchHorizonMetrics,
  fetchHourlyMetrics,
  fetchMetrics,
} from "@/lib/api"
import { ConfigResponse, ForecastSlot, HorizonMetric, HourlyMetric, MetricsSummary } from "@/lib/types"

const MIN_DATE = new Date(2026, 0, 2) // 2 Jan 2026
const MAX_DATE = new Date(2026, 1, 1) // 1 Feb 2026

export default function DashboardPage() {
  const [mode, setMode] = React.useState<"single" | "range">("single")
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date(2026, 0, 2))
  const [dateRange, setDateRange] = React.useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(2026, 0, 2),
    to: new Date(2026, 0, 8),
  })
  const [refreshKey, setRefreshKey] = React.useState(0)

  // API State
  const [config, setConfig] = React.useState<ConfigResponse | null>(null)
  const [slots, setSlots] = React.useState<ForecastSlot[]>([])
  const [metrics, setMetrics] = React.useState<MetricsSummary | null>(null)
  const [hourlyMetrics, setHourlyMetrics] = React.useState<HourlyMetric[]>([])
  const [horizonMetrics, setHorizonMetrics] = React.useState<HorizonMetric[]>([])

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  console.log(hourlyMetrics)
  
  // Fetch initial config
  React.useEffect(() => {
    fetchConfig()
      .then((cfg) => setConfig(cfg))
      .catch((err) => console.error("Config fetch error:", err))
  }, [])

  // Check if current date selection is valid
  const isDateOutOfRange = React.useMemo(() => {
    if (mode === "single") {
      return isBefore(selectedDate, MIN_DATE) || isAfter(selectedDate, MAX_DATE)
    } else {
      if (!dateRange.from) return true
      return (
        isBefore(dateRange.from, MIN_DATE) ||
        isAfter(dateRange.from, MAX_DATE) ||
        (dateRange.to && (isBefore(dateRange.to, MIN_DATE) || isAfter(dateRange.to, MAX_DATE)))
      )
    }
  }, [mode, selectedDate, dateRange])

  // Load dashboard data asynchronously
  React.useEffect(() => {
    let ignore = false

    const timer = setTimeout(async () => {
      if (isDateOutOfRange) {
        setSlots([])
        setMetrics(null)
        setHourlyMetrics([])
        setHorizonMetrics([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        if (mode === "single") {
          const dateStr = format(selectedDate, "yyyy-MM-dd")
          const forecastRes = await fetchForecast(dateStr)
          if (ignore) return
          const currentSlots = forecastRes.slots

          setSlots(currentSlots)
          const [met, hourly, horizon] = await Promise.all([
            fetchMetrics(dateStr, dateStr, currentSlots),
            fetchHourlyMetrics(dateStr, dateStr, currentSlots),
            fetchHorizonMetrics(dateStr, dateStr, currentSlots),
          ])

          if (ignore) return
          setMetrics(met)
          setHourlyMetrics(hourly)
          setHorizonMetrics(horizon)
        } else {
          if (!dateRange.from) return
          const startStr = format(dateRange.from, "yyyy-MM-dd")
          const endStr = format(dateRange.to || dateRange.from, "yyyy-MM-dd")

          const forecastRes = await fetchForecastRange(startStr, endStr)
          if (ignore) return
          const currentSlots = forecastRes.slots

          setSlots(currentSlots)
          const [met, hourly, horizon] = await Promise.all([
            fetchMetrics(startStr, endStr, currentSlots),
            fetchHourlyMetrics(startStr, endStr, currentSlots),
            fetchHorizonMetrics(startStr, endStr, currentSlots),
          ])

          if (ignore) return
          setMetrics(met)
          setHourlyMetrics(hourly)
          setHorizonMetrics(horizon)
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error("Dashboard data fetch error:", err)
          const msg = err instanceof Error ? err.message : "Failed to load wind forecast data. Please check connection."
          setError(msg)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }, 0)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [mode, selectedDate, dateRange, isDateOutOfRange, refreshKey])

  const handleRefresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const activeDateLabel = React.useMemo(() => {
    if (mode === "single") {
      return format(selectedDate, "d MMMM yyyy")
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "d MMM")} – ${format(dateRange.to, "d MMM yyyy")}`
    }
    return dateRange.from ? format(dateRange.from, "d MMM yyyy") : ""
  }, [mode, selectedDate, dateRange])


  console.log(slots)
  
  return (
    <div className="flex min-h-screen flex-col bg-muted/20 font-sans">
      {/* 1. Header */}
      <Header onRefresh={handleRefresh} isRefreshing={loading} />

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-4 sm:px-6">
        {/* 2. Controls Bar */}
        <ControlsBar
          mode={mode}
          onModeChange={setMode}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          cutoffTime={config ? `${config.cutoff} on D-1 (${config.timezone || "UK time"})` : undefined}
          minDate={MIN_DATE}
          maxDate={MAX_DATE}
        />

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4" />
              <div>
                <AlertTitle className="text-xs font-semibold">Error Loading Data</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="h-7 gap-1.5 text-xs">
              <RefreshCw className="size-3" />
              <span>Retry</span>
            </Button>
          </Alert>
        )}

        {/* Empty State */}
        {isDateOutOfRange ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card px-4 py-20 text-center">
            <CalendarX className="mb-3 size-10 text-muted-foreground/60" />
            <h2 className="text-sm font-semibold text-foreground">No data for this date</h2>
            <p className="mt-1 mb-4 max-w-sm text-xs text-muted-foreground">
              Pick a date between 2 Jan and 1 Feb 2026. Decisions are evaluated against January 2026 day-ahead power auctions.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDate(MIN_DATE)
                setDateRange({ from: MIN_DATE, to: new Date(2026, 0, 8) })
              }}
              className="text-xs"
            >
              Reset to 2 Jan 2026
            </Button>
          </div>
        ) : (
          <>
            {/* 3. Buyer Takeaway */}
            <TakeawayAlert metrics={metrics} loading={loading} />

            {/* 4. KPI Cards */}
            <KpiCards metrics={metrics} loading={loading} />

            {/* 5. Main Forecast Chart */}
            <ForecastChart
              slots={slots}
              p90Error={metrics?.p90}
              loading={loading}
              dateLabel={activeDateLabel}
            />

            {/* 6. Side-by-Side Smaller Charts */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ErrorByHourChart data={hourlyMetrics} loading={loading} />
              <ErrorByHorizonChart data={horizonMetrics} loading={loading} />
            </div>

            {/* 7. Collapsible Slot Details Table */}
            <SlotTable slots={slots} loading={loading} />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 px-4 py-3 text-center text-xs text-muted-foreground">
        Wind Forecast Portal &bull; Day-Ahead Power Procurement Analytics &bull; Elexon BMRS January 2026
      </footer>
    </div>
  )
}
