import { ConfigResponse, ForecastSlot, HorizonMetric, HourlyMetric, MetricsSummary } from "./types";

// Simple pseudo-random generator with seed for deterministic mock data per date
function pseudoRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

export function getMockConfig(): ConfigResponse {
  return {
    cutoff: "09:00",
    timezone: "UTC",
    dataStart: "2026-01-02",
    dataEnd: "2026-02-01",
  };
}

export function generateMockDaySlots(dateStr: string, p90Margin = 780): ForecastSlot[] {
  const seed = stringToSeed(dateStr);
  const rand = pseudoRandom(seed);

  // Weather pattern parameters for this date
  const baseWind = 3000 + rand() * 6500; // 3,000 - 9,500 MW base
  const peakWind = baseWind + (rand() * 2500 - 1000);
  const phase = rand() * Math.PI * 2;
  const biasOffset = (rand() - 0.45) * 200; // slight overall bias

  const slots: ForecastSlot[] = [];

  // Parse delivery date components
  const [year, month, day] = dateStr.split("-").map(Number);
  const prevDate = new Date(Date.UTC(year, month - 1, day - 1));
  const prevDateStr = prevDate.toISOString().split("T")[0];

  // 24 Hourly delivery slots (00:00 to 23:00 UTC)
  for (let hour = 0; hour < 24; hour++) {
    const slotDate = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
    const startTimeIso = slotDate.toISOString();

    // Diurnal & frontal wave simulation
    const angle = (hour / 24) * Math.PI * 2 + phase;
    const diurnal = Math.sin(angle) * (1200 + rand() * 500);
    const noise = (rand() - 0.5) * 400;

    // Actual generation between 1,000 and 12,500 MW
    const rawActual = Math.round(Math.max(1050, Math.min(12200, (baseWind + peakWind) / 2 + diurnal + noise)));

    // Rare missing forecast slot simulation (hour 17 on 15 Jan or 1 slot if rand() < 0.02)
    const isMissingForecast = dateStr === "2026-01-15" && hour === 17;

    if (isMissingForecast) {
      slots.push({
        startTime: startTimeIso,
        settlementPeriod: hour + 1,
        actual: rawActual,
        forecast: null,
        publishTime: null,
        error: null,
        absError: null,
        errorPercent: null,
        horizonHours: null,
        typicalErrorLower: null,
        typicalErrorUpper: null,
      });
      continue;
    }

    // Forecast error of roughly ±5% - 15% with some bias
    const errorPct = (rand() - 0.48) * 0.22; // -10.5% to +11.5%
    const errorMw = Math.round(rawActual * errorPct + biasOffset);
    const forecastMw = Math.max(900, Math.round(rawActual + errorMw));

    // D-1 decision publication time before 09:00 UK time (e.g. between 06:30 and 08:45)
    const pubMinute = Math.floor(rand() * 45);
    const pubHour = 7 + Math.floor(rand() * 2); // 7 or 8
    const pubTime = `${prevDateStr}T${String(pubHour).padStart(2, "0")}:${String(pubMinute).padStart(2, "0")}:00Z`;
    const pubDate = new Date(pubTime);

    const horizonHours = Number(((slotDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60)).toFixed(1));
    const actualError = forecastMw - rawActual;
    const absError = Math.abs(actualError);
    const errorPercent = Number(((actualError / rawActual) * 100).toFixed(1));

    slots.push({
      startTime: startTimeIso,
      settlementPeriod: hour + 1,
      actual: rawActual,
      forecast: forecastMw,
      publishTime: pubTime,
      error: actualError,
      absError: absError,
      errorPercent: errorPercent,
      horizonHours: horizonHours,
      typicalErrorLower: Math.max(0, forecastMw - p90Margin),
      typicalErrorUpper: forecastMw + p90Margin,
    });
  }

  return slots;
}

export function generateMockHourlyMetrics(slots: ForecastSlot[]): HourlyMetric[] {
  const byHour: Record<number, number[]> = {};

  slots.forEach((s) => {
    if (s.absError !== null && s.absError !== undefined) {
      const d = new Date(s.startTime);
      const h = d.getUTCHours();
      if (!byHour[h]) byHour[h] = [];
      byHour[h].push(s.absError);
    }
  });

  return Array.from({ length: 24 }, (_, h) => {
    const errors = byHour[h] || [];
    const mae = errors.length > 0 ? Math.round(errors.reduce((a, b) => a + b, 0) / errors.length) : 650;
    return { hour: h, mae };
  });
}

export function generateMockHorizonMetrics(slots: ForecastSlot[]): HorizonMetric[] {
  const byHorizon: Record<number, number[]> = {};

  slots.forEach((s) => {
    if (s.absError !== null && s.absError !== undefined && s.horizonHours !== null && s.horizonHours !== undefined) {
      const bucket = Math.round(s.horizonHours);
      if (!byHorizon[bucket]) byHorizon[bucket] = [];
      byHorizon[bucket].push(s.absError);
    }
  });

  const keys = Object.keys(byHorizon)
    .map(Number)
    .sort((a, b) => a - b);

  if (keys.length === 0) {
    return Array.from({ length: 18 }, (_, i) => ({
      horizonHours: 15 + i * 2,
      mae: Math.round(500 + i * 35 + Math.random() * 50),
    }));
  }

  return keys.map((h) => {
    const list = byHorizon[h];
    const mae = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
    return { horizonHours: h, mae };
  });
}

export function calculateMetricsFromSlots(slots: ForecastSlot[]): MetricsSummary {
  const valid = slots.filter((s) => s.error !== null && s.error !== undefined && s.actual !== null);

  if (valid.length === 0) {
    return {
      mae: 0,
      rmse: 0,
      bias: 0,
      p90: 0,
      nmae: 0,
      underForecastPct: 0,
      overForecastPct: 0,
      sampleCount: 0,
    };
  }

  const errors = valid.map((s) => s.error as number);
  const absErrors = valid.map((s) => s.absError as number);
  const actuals = valid.map((s) => s.actual as number);

  const mae = Math.round(absErrors.reduce((a, b) => a + b, 0) / absErrors.length);
  const sumSq = errors.reduce((acc, e) => acc + e * e, 0);
  const rmse = Math.round(Math.sqrt(sumSq / errors.length));
  const bias = Math.round(errors.reduce((a, b) => a + b, 0) / errors.length);

  // P90 error calculation
  const sortedAbs = [...absErrors].sort((a, b) => a - b);
  const p90Index = Math.min(sortedAbs.length - 1, Math.floor(sortedAbs.length * 0.9));
  const p90 = Math.round(sortedAbs[p90Index]);

  const meanActual = actuals.reduce((a, b) => a + b, 0) / actuals.length;
  const nmae = Number(((mae / (meanActual || 1)) * 100).toFixed(1));

  const underCount = errors.filter((e) => e < 0).length;
  const overCount = errors.filter((e) => e > 0).length;
  const underForecastPct = Number(((underCount / errors.length) * 100).toFixed(1));
  const overForecastPct = Number(((overCount / errors.length) * 100).toFixed(1));

  return {
    mae,
    rmse,
    bias,
    p90,
    nmae,
    underForecastPct,
    overForecastPct,
    sampleCount: valid.length,
  };
}
