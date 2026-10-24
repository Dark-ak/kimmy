export interface ForecastSlot {
  startTime: string; // ISO string e.g. "2026-01-02T00:00:00Z"
  settlementPeriod?: number; // 1 to 48
  actual: number | null; // Wind generation in MW
  forecast: number | null; // Forecasted wind generation in MW
  publishTime: string | null; // ISO string when forecast was published
  error: number | null; // forecast - actual (MW)
  absError?: number | null; // |forecast - actual|
  errorPercent?: number | null; // ((forecast - actual) / actual) * 100
  horizonHours?: number | null; // hours between publishTime and startTime
  typicalErrorLower?: number | null; // forecast - P90
  typicalErrorUpper?: number | null; // forecast + P90
}

export interface ForecastResponse {
  deliveryDate?: string;
  cutoffTime?: string;
  slots: ForecastSlot[];
  totalSlots?: number;
  missingSlots?: number;
}

export interface MetricsSummary {
  mae: number; // Mean Absolute Error in MW
  rmse: number; // Root Mean Squared Error in MW
  bias: number; // Mean Error (forecast - actual) in MW
  p90: number; // 90th percentile of absolute error in MW (Suggested safety margin)
  nmae: number; // Normalized MAE (% of mean generation)
  sampleCount?: number;
  underForecastPct?: number;
  overForecastPct?: number;
}

export interface HourlyMetric {
  hour: number; // 0 to 23
  mae: number; // MAE in MW
}

export interface HorizonMetric {
  horizonHours: number; // e.g. 15, 16, 17 ... 38
  mae: number; // MAE in MW
}

export interface ConfigResponse {
  cutoff: string; // e.g. "09:00"
  timezone?: string; // "UTC"
  dataStart: string; // "2026-01-02"
  dataEnd: string; // "2026-02-01"
}
