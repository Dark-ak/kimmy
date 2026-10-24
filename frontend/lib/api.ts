import { ConfigResponse, ForecastResponse, ForecastSlot, HorizonMetric, HourlyMetric, MetricsSummary } from "./types";
import {
  calculateMetricsFromSlots,
  generateMockDaySlots,
  generateMockHorizonMetrics,
  generateMockHourlyMetrics,
  getMockConfig,
} from "./mock";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true"; // default to live backend if not explicitly set to true

interface RawBackendSlot {
  actual?: number | null;
  actual_mw?: number | null;
  forecast?: number | null;
  forecast_mw?: number | null;
  error?: number | null;
  error_mw?: number | null;
  startTime?: string;
  start_time?: string;
  publishTime?: string | null;
  publish_time?: string | null;
  settlementPeriod?: number;
  settlement_period?: number;
  horizonHours?: number | null;
  horizon_hours?: number | null;
}

interface RawHourlyBackend {
  hour: number;
  mae: number;
}

interface RawHorizonBackend {
  horizon_hours?: number;
  horizonHours?: number;
  mae: number;
}

function normalizeSlot(raw: RawBackendSlot, p90Margin = 1500): ForecastSlot {
  const actual = raw.actual ?? raw.actual_mw ?? null;
  const forecast = raw.forecast ?? raw.forecast_mw ?? null;
  const error = raw.error ?? raw.error_mw ?? (forecast !== null && actual !== null ? forecast - actual : null);
  const startTime = raw.startTime || raw.start_time || "";
  const publishTime = raw.publishTime || raw.publish_time || null;
  const settlementPeriod = raw.settlementPeriod ?? raw.settlement_period;
  const horizonHours = raw.horizonHours ?? raw.horizon_hours ?? null;
  const absError = error !== null ? Math.abs(error) : null;
  const errorPercent =
    error !== null && actual && actual > 0 ? Number(((error / actual) * 100).toFixed(1)) : null;

  return {
    startTime,
    settlementPeriod,
    actual,
    forecast,
    publishTime,
    error,
    absError,
    errorPercent,
    horizonHours,
    typicalErrorLower: forecast !== null ? Math.max(0, forecast - p90Margin) : null,
    typicalErrorUpper: forecast !== null ? forecast + p90Margin : null,
  };
}

// Helper for date sequence in mock range mode
function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startDateStr);
  const end = new Date(endDateStr);

  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

export async function fetchConfig(): Promise<ConfigResponse> {
  if (USE_MOCK) {
    return getMockConfig();
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      cutoff: data.cutoff_time || data.cutoff || "09:00",
      timezone: data.timezone || "UTC",
      dataStart: data.data_start_date || data.dataStart || "2026-01-02",
      dataEnd: data.data_end_date || data.dataEnd || "2026-02-01",
    };
  } catch (e) {
    console.warn("Backend unavailable, falling back to mock config:", e);
    return getMockConfig();
  }
}

export async function fetchForecast(deliveryDate: string, cutoffTime?: string): Promise<ForecastResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    const slots = generateMockDaySlots(deliveryDate);
    return {
      deliveryDate,
      cutoffTime: cutoffTime || "09:00",
      slots,
      totalSlots: slots.length,
      missingSlots: slots.filter((s) => s.forecast === null).length,
    };
  }

  try {
    const url = new URL(`${API_BASE_URL}/api/forecast`);
    url.searchParams.set("delivery_date", deliveryDate);
    if (cutoffTime) url.searchParams.set("cutoff_time", cutoffTime);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawSlots: RawBackendSlot[] = data.slots || [];
    const normalized = rawSlots.map((s) => normalizeSlot(s));

    return {
      deliveryDate: data.delivery_date || deliveryDate,
      cutoffTime: data.cutoff_time || "09:00",
      slots: normalized,
      totalSlots: data.total_slots ?? normalized.length,
      missingSlots: data.missing_slots ?? normalized.filter((s) => s.forecast === null).length,
    };
  } catch (e) {
    console.warn("Backend unavailable, falling back to mock forecast:", e);
    const slots = generateMockDaySlots(deliveryDate);
    return {
      deliveryDate,
      cutoffTime: cutoffTime || "09:00",
      slots,
      totalSlots: slots.length,
      missingSlots: slots.filter((s) => s.forecast === null).length,
    };
  }
}

export async function fetchForecastRange(
  start: string,
  end: string,
  cutoffTime?: string
): Promise<ForecastResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 150));
    const dates = getDatesInRange(start, end);
    const allSlots: ForecastSlot[] = [];
    dates.forEach((d) => allSlots.push(...generateMockDaySlots(d)));

    return {
      deliveryDate: `${start} to ${end}`,
      cutoffTime: cutoffTime || "09:00",
      slots: allSlots,
      totalSlots: allSlots.length,
      missingSlots: allSlots.filter((s) => s.forecast === null).length,
    };
  }

  try {
    const url = new URL(`${API_BASE_URL}/api/forecast/range`);
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    if (cutoffTime) url.searchParams.set("cutoff_time", cutoffTime);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawSlots: RawBackendSlot[] = data.slots || [];
    const normalized = rawSlots.map((s) => normalizeSlot(s));

    return {
      deliveryDate: `${start} to ${end}`,
      cutoffTime: data.cutoff_time || "09:00",
      slots: normalized,
      totalSlots: data.total_slots ?? normalized.length,
      missingSlots: normalized.filter((s) => s.forecast === null).length,
    };
  } catch (e) {
    console.warn("Backend unavailable, falling back to mock forecast range:", e);
    const dates = getDatesInRange(start, end);
    const allSlots: ForecastSlot[] = [];
    dates.forEach((d) => allSlots.push(...generateMockDaySlots(d)));
    return {
      deliveryDate: `${start} to ${end}`,
      cutoffTime: cutoffTime || "09:00",
      slots: allSlots,
      totalSlots: allSlots.length,
      missingSlots: allSlots.filter((s) => s.forecast === null).length,
    };
  }
}

export async function fetchMetrics(
  start?: string,
  end?: string,
  slotsCache?: ForecastSlot[]
): Promise<MetricsSummary> {
  if (USE_MOCK) {
    if (slotsCache && slotsCache.length > 0) return calculateMetricsFromSlots(slotsCache);
    return calculateMetricsFromSlots(generateMockDaySlots(start || "2026-01-02"));
  }

  try {
    const url = new URL(`${API_BASE_URL}/api/metrics`);
    if (start) url.searchParams.set("start", start);
    if (end) url.searchParams.set("end", end);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      mae: data.mae,
      rmse: data.rmse,
      bias: data.bias,
      p90: data.p90_absolute_error ?? data.p90,
      nmae: data.mape ?? data.nmae ?? 0,
      sampleCount: data.sample_count,
      underForecastPct: data.under_forecast_pct,
      overForecastPct: data.over_forecast_pct,
    };
  } catch (e) {
    console.warn("Backend unavailable, calculating metrics from slots:", e);
    if (slotsCache && slotsCache.length > 0) return calculateMetricsFromSlots(slotsCache);
    return calculateMetricsFromSlots(generateMockDaySlots(start || "2026-01-02"));
  }
}

export async function fetchHourlyMetrics(
  start?: string,
  end?: string,
  slotsCache?: ForecastSlot[]
): Promise<HourlyMetric[]> {
  if (USE_MOCK) {
    if (slotsCache && slotsCache.length > 0) return generateMockHourlyMetrics(slotsCache);
    return generateMockHourlyMetrics(generateMockDaySlots(start || "2026-01-02"));
  }

  try {
    const url = new URL(`${API_BASE_URL}/api/metrics/by-hour`);
    if (start) url.searchParams.set("start", start);
    if (end) url.searchParams.set("end", end);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: RawHourlyBackend[] = await res.json();
    return data.map((d) => ({
      hour: d.hour,
      mae: d.mae,
    }));
  } catch (e) {
    console.warn("Backend unavailable, generating hourly metrics:", e);
    if (slotsCache && slotsCache.length > 0) return generateMockHourlyMetrics(slotsCache);
    return generateMockHourlyMetrics(generateMockDaySlots(start || "2026-01-02"));
  }
}

export async function fetchHorizonMetrics(
  start?: string,
  end?: string,
  slotsCache?: ForecastSlot[]
): Promise<HorizonMetric[]> {
  if (USE_MOCK) {
    if (slotsCache && slotsCache.length > 0) return generateMockHorizonMetrics(slotsCache);
    return generateMockHorizonMetrics(generateMockDaySlots(start || "2026-01-02"));
  }

  try {
    const url = new URL(`${API_BASE_URL}/api/metrics/by-horizon`);
    if (start) url.searchParams.set("start", start);
    if (end) url.searchParams.set("end", end);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: RawHorizonBackend[] = await res.json();
    return data.map((d) => ({
      horizonHours: d.horizon_hours ?? d.horizonHours ?? 0,
      mae: d.mae,
    }));
  } catch (e) {
    console.warn("Backend unavailable, generating horizon metrics:", e);
    if (slotsCache && slotsCache.length > 0) return generateMockHorizonMetrics(slotsCache);
    return generateMockHorizonMetrics(generateMockDaySlots(start || "2026-01-02"));
  }
}
