"use client";

import * as React from "react";
import {
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricsSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  metrics: MetricsSummary | null;
  loading?: boolean;
}

export function KpiCards({ metrics, loading }: KpiCardsProps) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-border/80 bg-card p-4 shadow-none">
            <div className="flex items-center justify-between pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-3.5 rounded-full" />
            </div>
            <Skeleton className="mb-1 h-7 w-24" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  const isLargeBias = Math.abs(metrics.bias) >= 150;
  const biasPositive = metrics.bias > 0;
  const biasNegative = metrics.bias < 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {/* 1. MAE */}
      <Card className="border-border/80 bg-card p-3.5 shadow-none">
        <div className="flex items-center justify-between pb-1 text-muted-foreground">
          <span className="text-xs font-medium">MAE</span>
          <Tooltip>
            <TooltipTrigger render={<button type="button" className="cursor-help" />}>
              <Info className="size-3.5 text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-55 text-xs">
              Mean Absolute Error: the average magnitude of error in MW across evaluated settlement slots.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {metrics.mae.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">MW</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Average forecast deviance</p>
      </Card>

      {/* 2. RMSE */}
      <Card className="border-border/80 bg-card p-3.5 shadow-none">
        <div className="flex items-center justify-between pb-1 text-muted-foreground">
          <span className="text-xs font-medium">RMSE</span>
          <Tooltip>
            <TooltipTrigger render={<button type="button" className="cursor-help" />}>
              <Info className="size-3.5 text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-55 text-xs">
              Root Mean Squared Error: disproportionately penalizes large error spikes that drive high imbalance settlement charges.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {metrics.rmse.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">MW</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Variance-sensitive error</p>
      </Card>

      {/* 3. Bias */}
      <Card className="border-border/80 bg-card p-3.5 shadow-none">
        <div className="flex items-center justify-between pb-1 text-muted-foreground">
          <span className="text-xs font-medium">Systemic Bias</span>
          <Tooltip>
            <TooltipTrigger render={<button type="button" className="cursor-help" />}>
              <Info className="size-3.5 text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-55 text-xs">
              Mean Error (Forecast - Actual). Positive means the forecast systematically over-predicted wind. Large bias requires active hedging.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-2xl font-bold tracking-tight",
              isLargeBias ? "text-destructive" : "text-foreground"
            )}
          >
            {biasPositive ? `+${metrics.bias.toLocaleString()}` : metrics.bias.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">MW</span>
          {biasPositive && <ArrowUpRight className={cn("size-4", isLargeBias ? "text-destructive" : "text-amber-500")} />}
          {biasNegative && <ArrowDownRight className={cn("size-4", isLargeBias ? "text-destructive" : "text-blue-500")} />}
          {!biasPositive && !biasNegative && <Minus className="size-4 text-muted-foreground" />}
        </div>
        <p className={cn("mt-1 flex items-center gap-1 text-[11px]", isLargeBias ? "font-medium text-destructive" : "text-muted-foreground")}>
          {isLargeBias && <AlertTriangle className="size-3" />}
          {biasPositive ? "Over-forecast tendency" : biasNegative ? "Under-forecast tendency" : "Neutral bias"}
        </p>
      </Card>

      {/* 4. P90 Error (Safety Margin) */}
      <Card className="border-primary/20 bg-card p-3.5 shadow-none">
        <div className="flex items-center justify-between pb-1 text-muted-foreground">
          <span className="text-xs font-medium text-foreground">Suggested Safety Margin</span>
          <Tooltip>
            <TooltipTrigger render={<button type="button" className="cursor-help" />}>
              <Info className="size-3.5 text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-55 text-xs">
              90th percentile of absolute error (P90). 90% of slots experienced errors less than or equal to this capacity buffer.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-primary">
            {metrics.p90.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">MW</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">P90 absolute error</p>
      </Card>

      {/* 5. Normalized MAE */}
      <Card className="border-border/80 bg-card p-3.5 shadow-none">
        <div className="flex items-center justify-between pb-1 text-muted-foreground">
          <span className="text-xs font-medium">Normalized MAE</span>
          <Tooltip>
            <TooltipTrigger render={<button type="button" className="cursor-help" />}>
              <Info className="size-3.5 text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-55 text-xs">
              Normalized MAE as % of average wind generation over the window. Accounts for variations between high and low wind periods.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {metrics.nmae.toFixed(1)}%
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">% of mean generation</p>
      </Card>
    </div>
  );
}
