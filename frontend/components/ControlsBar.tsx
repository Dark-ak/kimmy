"use client"

import * as React from "react"
import { format, addDays, isBefore, isAfter, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Info } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface ControlsBarProps {
  mode: "single" | "range"
  onModeChange: (mode: "single" | "range") => void
  selectedDate: Date
  onDateChange: (date: Date) => void
  dateRange: { from: Date | undefined; to: Date | undefined }
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void
  cutoffTime?: string
  minDate?: Date
  maxDate?: Date
}

export function ControlsBar({
  mode,
  onModeChange,
  selectedDate,
  onDateChange,
  dateRange,
  onDateRangeChange,
  cutoffTime = "09:00 on D-1 (UK time)",
  minDate = new Date(2026, 0, 2), // Jan 2, 2026
  maxDate = new Date(2026, 1, 1), // Feb 1, 2026
}: ControlsBarProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false)

  const isPrevDisabled = mode === "single" && (isSameDay(selectedDate, minDate) || isBefore(selectedDate, minDate))
  const isNextDisabled = mode === "single" && (isSameDay(selectedDate, maxDate) || isAfter(selectedDate, maxDate))

  const handlePrevDay = () => {
    if (!isPrevDisabled) {
      onDateChange(addDays(selectedDate, -1))
    }
  }

  const handleNextDay = () => {
    if (!isNextDisabled) {
      onDateChange(addDays(selectedDate, 1))
    }
  }

  const isDateDisabled = (date: Date) => {
    return isBefore(date, minDate) || isAfter(date, maxDate)
  }

  return (
    <Card className="border-border/80 bg-card p-3 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mode toggle & Date pickers */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Mode Toggle */}
          <ToggleGroup
            value={[mode]}
            onValueChange={(val: readonly string[]) => {
              const selectedVal = Array.isArray(val) ? val[val.length - 1] : val
              if (selectedVal === "single" || selectedVal === "range") {
                onModeChange(selectedVal)
              }
            }}
            variant="outline"
            size="sm"
            className="rounded-md border bg-muted/40 p-0.5"
          >
            <ToggleGroupItem value="single" className="px-2.5 py-1 text-xs data-[state=on]:bg-background data-[state=on]:shadow-xs">
              Single day
            </ToggleGroupItem>
            <ToggleGroupItem value="range" className="px-2.5 py-1 text-xs data-[state=on]:bg-background data-[state=on]:shadow-xs">
              Date range
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="hidden h-4 w-px bg-border/80 sm:block" />

          {/* Single Day Navigation & Picker */}
          {mode === "single" ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handlePrevDay}
                disabled={isPrevDisabled}
                title="Previous delivery day"
                className="size-8"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-[145px] justify-start text-xs font-normal"
                    />
                  }
                >
                  <CalendarIcon className="mr-1.5 size-3.5 text-muted-foreground" />
                  <span>{format(selectedDate, "d MMM yyyy")}</span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        onDateChange(date)
                        setPopoverOpen(false)
                      }
                    }}
                    defaultMonth={selectedDate}
                    disabled={isDateDisabled}
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleNextDay}
                disabled={isNextDisabled}
                title="Next delivery day"
                className="size-8"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : (
            /* Range Picker */
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 min-w-[210px] justify-start text-xs font-normal"
                  />
                }
              >
                <CalendarIcon className="mr-1.5 size-3.5 text-muted-foreground" />
                <span>
                  {dateRange.from ? (
                    dateRange.to ? (
                      `${format(dateRange.from, "d MMM")} - ${format(dateRange.to, "d MMM yyyy")}`
                    ) : (
                      format(dateRange.from, "d MMM yyyy")
                    )
                  ) : (
                    "Select date range"
                  )}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange as DateRange | undefined}
                  onSelect={(range: DateRange | undefined) => {
                    onDateRangeChange(range ? { from: range.from, to: range.to } : { from: undefined, to: undefined })
                    if (range?.from && range?.to) {
                      setPopoverOpen(false)
                    }
                  }}
                  defaultMonth={dateRange.from || minDate}
                  disabled={isDateDisabled}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Right: Decision cutoff info badge */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger render={<div className="inline-flex cursor-help" />}>
              <Badge variant="secondary" className="gap-1.5 border border-border/60 bg-muted/70 px-2.5 py-1 text-[11px] font-normal text-foreground">
                <Clock className="size-3 text-muted-foreground" />
                <span>Decision cutoff: {cutoffTime}</span>
                <Info className="ml-0.5 size-3 text-muted-foreground opacity-70" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              Forecasts published after this time are excluded. Matches GB day-ahead power auction timelines (configurable).
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  )
}
