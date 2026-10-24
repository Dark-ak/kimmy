"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { HourlyMetric } from "@/lib/types"

interface ErrorByHourChartProps {
  data: HourlyMetric[]
  loading?: boolean
}

interface HourlyChartItem {
  hour: number
  hourLabel: string
  mae: number
}

interface HourlyTooltipPayloadEntry {
  payload?: HourlyChartItem
}

interface HourlyTooltipProps {
  active?: boolean
  payload?: HourlyTooltipPayloadEntry[]
}

const chartConfig = {
  mae: {
    label: "Mean Absolute Error",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

function ErrorByHourTooltip({ active, payload }: HourlyTooltipProps) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="space-y-1 rounded-md border border-border/80 bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur-md">
      <div className="font-semibold text-foreground">
        Hour {String(d.hour).padStart(2, "0")}:00 - {String(d.hour).padStart(2, "0")}:59 UTC
      </div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>MAE:</span>
        <span className="font-mono font-medium text-foreground">{d.mae.toLocaleString()} MW</span>
      </div>
    </div>
  )
}

export function ErrorByHourChart({ data, loading }: ErrorByHourChartProps) {
  if (loading) {
    return (
      <Card className="border-border/80 bg-card shadow-none">
        <CardHeader className="pb-2">
          <Skeleton className="mb-1 h-5 w-36" />
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-55 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  const chartData: HourlyChartItem[] = data.map((d) => ({
    hour: d.hour,
    hourLabel: `${String(d.hour).padStart(2, "0")}:00`,
    mae: d.mae,
  }))

  return (
    <Card className="border-border/80 bg-card shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Error by Hour of Day</CardTitle>
        <CardDescription className="text-xs">
          Mean absolute error (MW) across 24 delivery hours (UTC)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <ChartContainer config={chartConfig} className="h-55 w-full">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickFormatter={(h) => (h % 4 === 0 ? `${h}h` : "")}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip content={<ErrorByHourTooltip />} />
            <Bar
              dataKey="mae"
              fill="var(--chart-3)"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
