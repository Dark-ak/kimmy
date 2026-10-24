"use client"

import * as React from "react"
import { Lightbulb } from "lucide-react"

import { Alert } from "@/components/ui/alert"
import { MetricsSummary } from "@/lib/types"

interface TakeawayAlertProps {
  metrics: MetricsSummary | null
  loading?: boolean
}

export function TakeawayAlert({ metrics, loading }: TakeawayAlertProps) {
  if (loading || !metrics || metrics.sampleCount === 0) {
    return null
  }

  const p90Mw = metrics.p90.toLocaleString()
  const biasAbs = Math.abs(metrics.bias).toLocaleString()
  const biasDirection = metrics.bias >= 0 ? "over-forecast" : "under-forecast"
  const biasImplication =
    metrics.bias > 0
      ? "over-forecasting wind leaves the portfolio exposed to buying shortfall power on the intra-day market"
      : "under-forecasting wind means actual deliveries may exceed scheduled trades"

  return (
    <Alert className="flex items-center gap-3 border-primary/30 bg-primary/5 px-3.5 py-2.5 text-foreground shadow-none">
      <Lightbulb className="size-4.5 shrink-0 text-primary" />
      <div className="flex-1 text-xs sm:text-sm">
        <span className="mr-1.5 font-semibold text-foreground">Day-Ahead Buyer Action:</span>
        <span>
          Plan for up to <strong className="font-semibold text-foreground">{p90Mw} MW</strong> of wind variation at 90% confidence (P90 margin).
          The day-ahead cutoff model {biasDirection} by <strong className="font-semibold text-foreground">{biasAbs} MW</strong> on average ({biasImplication}).
        </span>
      </div>
    </Alert>
  )
}
