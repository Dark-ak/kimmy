"use client"

import * as React from "react"
import { Wind, Database, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"

interface HeaderProps {
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function Header({ onRefresh, isRefreshing }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Wind className="size-5" />
          </div>
          <div>
            <h1 className="text-base leading-none font-bold tracking-tight text-foreground sm:text-lg">
              Wind Forecast Portal
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              UK day-ahead wind generation: forecast vs actual
            </p>
          </div>
        </div>

        {/* Right: Data badge & Controls */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="size-8"
              title="Refresh data"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            </Button>
          )}

          <Badge
            variant="outline"
            className="hidden gap-1.5 border-border bg-muted/30 px-2.5 py-1 text-[11px] font-normal sm:inline-flex"
          >
            <Database className="size-3 text-muted-foreground" />
            <span>Data: Elexon BMRS, January 2026</span>
          </Badge>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
