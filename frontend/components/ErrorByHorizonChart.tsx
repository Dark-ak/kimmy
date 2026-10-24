"use client"

import * as React from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { HorizonMetric } from "@/lib/types"

interface ErrorByHorizonChartProps {
  data: HorizonMetric[]
  loading?: boolean
}

interface HorizonChartItem {
  horizon: number
  horizonLabel: string
  mae: number
}

interface HorizonTooltipPayloadEntry {
  payload?: HorizonChartItem
}

interface HorizonTooltipProps {
  active?: boolean
  payload?: HorizonTooltipPayloadEntry[]
}

const chartConfig = {
  mae: {
    label: "Mean Absolute Error",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

function ErrorByHorizonTooltip({ active, payload }: HorizonTooltipProps) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="space-y-1 rounded-md border border-border/80 bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur-md">
      <div className="font-semibold text-foreground">Forecast Horizon: {d.horizon}h</div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>MAE:</span>
        <span className="font-mono font-medium text-foreground">{d.mae.toLocaleString()} MW</span>
      </div>
    </div>
  )
}

export function ErrorByHorizonChart({ data, loading }: ErrorByHorizonChartProps) {
  if (loading) {
    return (
      <Card className="border-border/80 bg-card shadow-none">
        <CardHeader className="pb-2">
          <Skeleton className="mb-1 h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-55 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  const chartData: HorizonChartItem[] = data.map((d) => ({
    horizon: d.horizonHours,
    horizonLabel: `${d.horizonHours}h`,
    mae: d.mae,
  }))

  return (
    <Card className="border-border/80 bg-card shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Error by Forecast Horizon</CardTitle>
        <CardDescription className="text-xs">
          Accuracy decay over lead time (hours from publish time to delivery)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <ChartContainer config={chartConfig} className="h-55 w-full">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis
              dataKey="horizon"
              tickLine={false}
              axisLine={false}
              tickFormatter={(h) => `${h}h`}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip content={<ErrorByHorizonTooltip />} />
            <Line
              type="monotone"
              dataKey="mae"
              stroke="var(--chart-4)"
              strokeWidth={2.2}
              dot={{ r: 2.5, fill: "var(--chart-4)" }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
