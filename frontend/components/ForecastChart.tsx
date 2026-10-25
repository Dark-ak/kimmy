"use client"

import * as React from "react"
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  Legend,
} from "recharts"
import { AlertCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { ForecastSlot } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatUtcHour, formatUtcDate, formatUtcDateTime, formatUtcPublishTime } from "@/lib/format"

interface ForecastChartProps {
  slots: ForecastSlot[]
  p90Error?: number
  loading?: boolean
  dateLabel?: string
}

interface ChartItem {
  index: number
  rawTime: string
  timeLabel: string
  settlementPeriod?: number
  actual: number | null
  forecast: number | null
  error: number | null
  publishTime: string | null
  errorRange: [number, number] | null
  isMissing: boolean
}

interface TooltipPayloadEntry {
  payload?: ChartItem
}

interface TooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}

const chartConfig = {
  actual: {
    label: "Actual Generation",
    color: "var(--chart-1)",
  },
  forecast: {
    label: "Day-Ahead Forecast",
    color: "var(--chart-2)",
  },
  typicalRange: {
    label: "P90 Confidence Band",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function ForecastChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload
  if (!data) return null

  const actualStr = data.actual != null ? `${data.actual.toLocaleString()} MW` : "N/A"
  const forecastStr = data.forecast != null ? `${data.forecast.toLocaleString()} MW` : "Missing (< cutoff)"
  const errorStr =
    data.error != null
      ? `${data.error > 0 ? "+" : ""}${data.error.toLocaleString()} MW`
      : "N/A"
  const pubDateStr = data.publishTime
    ? formatUtcPublishTime(data.publishTime)
    : "None published before 09:00 cutoff"

  return (
    <div className="min-w-[230px] space-y-2 rounded-lg border border-border/80 bg-background/95 p-3 text-xs shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5 font-medium">
        <span className="text-foreground">{data.timeLabel} UTC</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full bg-(--chart-1)" />
          <span>Actual</span>
        </div>
        <span className="text-right font-mono font-medium text-foreground">{actualStr}</span>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full bg-(--chart-2)" />
          <span>Forecast</span>
        </div>
        <span className="text-right font-mono font-medium text-foreground">{forecastStr}</span>

        <span className="text-muted-foreground">Error (F - A)</span>
        <span
          className={cn(
            "text-right font-mono font-medium",
            data.error && data.error > 0
              ? "text-amber-500"
              : data.error && data.error < 0
              ? "text-blue-500"
              : "text-muted-foreground"
          )}
        >
          {errorStr}
        </span>
      </div>

      <div className="border-t border-border/50 pt-1.5 text-[11px] leading-tight text-muted-foreground">
        Forecast pub: <span className="font-mono text-foreground">{pubDateStr}</span>
      </div>
    </div>
  )
}

export function ForecastChart({
  slots,
  loading,
  dateLabel,
}: ForecastChartProps) {
  // Target roughly 6 to 8 evenly spaced ticks across any selected range
  const tickInterval = React.useMemo(() => {
    const total = slots.length
    if (total <= 24) return 2 // every 3 hours for single day (8 ticks)
    return Math.max(1, Math.floor(total / 8) - 1)
  }, [slots.length])

  if (loading) {
    return (
      <Card className="border-border/80 bg-card shadow-none">
        <CardHeader className="pb-2">
          <Skeleton className="mb-1 h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-85 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  // Transform data for Recharts (all times formatted strictly in UTC)
  const chartData: ChartItem[] = slots.map((s, idx) => {
    const timeOnly = formatUtcHour(s.startTime)
    const dateFormatted = formatUtcDate(s.startTime)
    const hasErrorRange =
      typeof s.typicalErrorLower === "number" && typeof s.typicalErrorUpper === "number"

    return {
      index: idx,
      rawTime: s.startTime,
      timeLabel: slots.length > 24 ? `${dateFormatted}, ${timeOnly}` : timeOnly,
      settlementPeriod: s.settlementPeriod,
      actual: s.actual,
      forecast: s.forecast,
      error: s.error,
      publishTime: s.publishTime,
      errorRange: hasErrorRange ? [s.typicalErrorLower as number, s.typicalErrorUpper as number] : null,
      isMissing: s.forecast === null,
    }
  })

  const missingCount = chartData.filter((d) => d.isMissing).length
  const missingSlots = chartData.filter((d) => d.isMissing)

  return (
    <Card className="border-border/80 bg-card shadow-none">
      <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span>Actual vs Latest Available Forecast</span>
            {dateLabel && <Badge variant="outline" className="text-xs font-normal">{dateLabel}</Badge>}
          </CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            Hourly UK wind generation compared with the final forecast published prior to day-ahead cutoff
          </CardDescription>
        </div>

        {missingCount > 0 && (
          <Badge variant="destructive" className="w-fit gap-1 text-xs font-normal">
            <AlertCircle className="size-3.5" />
            <span>{missingCount} slot(s) missing pre-cutoff forecast</span>
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="h-85 w-full sm:h-95">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />

            <XAxis
              dataKey="rawTime"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              interval={tickInterval}
              tickFormatter={(timeStr: string) => {
                if (slots.length <= 24) {
                  return formatUtcHour(timeStr)
                }
                if (slots.length <= 72) {
                  return formatUtcDateTime(timeStr)
                }
                return formatUtcDate(timeStr)
              }}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              domain={["auto", "auto"]}
            />

            <Tooltip content={<ForecastChartTooltip />} />

            {/* Top Legend */}
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
              formatter={(value) => {
                if (value === "actual") return "Actual Generation"
                if (value === "forecast") return "Latest Forecast"
                if (value === "errorRange") return "Typical Error Band (±P90)"
                return value
              }}
            />

            {/* Shaded P90 confidence area around forecast */}
            <Area
              name="errorRange"
              type="monotone"
              dataKey="errorRange"
              fill="var(--color-forecast)"
              fillOpacity={0.12}
              stroke="none"
              connectNulls={false}
            />

            {/* Actual generation: solid line in var(--actual-generation) */}
            <Line
              name="actual"
              type="monotone"
              dataKey="actual"
              stroke="var(--color-actual)"
              strokeWidth={2.2}
              dot={false}
              connectNulls={false}
            />

            {/* Latest forecast: dashed line in var(--day-ahead-forecast) */}
            <Line
              name="forecast"
              type="monotone"
              dataKey="forecast"
              stroke="var(--color-forecast)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
            />

            {/* Missing slot warning markers */}
            {missingSlots.map((m) => (
              <ReferenceDot
                key={m.index}
                x={m.rawTime}
                y={m.actual || 0}
                r={5}
                fill="var(--destructive)"
                stroke="var(--background)"
                strokeWidth={2}
              />
            ))}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
