# Wind Forecast Portal: Day-Ahead Wind Generation Analytics

A full-stack analytics platform built for a UK energy utility's power procurement team. It answers two critical questions for day-ahead auction participation:
1. **What is the latest wind generation forecast available prior to the auction cutoff on D-1?**
2. **How accurate are those forecasts historically, and what capacity safety margin (P90) is needed to avoid imbalance penalties?**

---

## 1. Project Overview & Architecture

```
React (Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, Recharts)
                              │  HTTP / JSON
                              ▼
FastAPI (Python 3.11+, Pydantic v2, SQLite / NumPy)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
           selection.py & metrics.py   elexon_jan2026.db (Preloaded)
                                        ▲
                                        │ ingest.py
                                 Elexon BMRS API
```

### Core Logic & Rules
- **Decision Timing**: Bids in Great Britain day-ahead power auctions (EPEX / Nord Pool) close between 09:20 and 09:50 UK time. Decisions are evaluated against a **09:00 UK time (UTC) cutoff on D-1**.
- **Forecast Selection**: For each target half-hour slot $T$ on delivery day $D$, the system selects $\max(\text{publishTime})$ where $\text{publishTime} \le \text{cutoff}(D-1)$.
- **Actuals Join**: Joined with National Grid / Elexon outturn (`FUELHH`, `fuelType == 'WIND'`) on `startTime == T`.
- **Error Calculation**: $\text{Error} = \text{Forecast} - \text{Actual}$. Positive values indicate over-forecasting (requiring thermal replacement); negative values indicate under-forecasting.
- **Missing Forecast Handling**: Slots lacking a forecast published prior to cutoff are flagged explicitly as missing without silent interpolation.
- **Delivery Scope**: Decisions made throughout **January 2026** (delivery window: 2 Jan 2026 to 1 Feb 2026; 1,488 half-hour settlement periods).

---

## 2. Repository Layout

```
.
├── PLAN.md                     # Architecture specification & roadmap
├── README.md                   # System documentation & setup guide
├── docker-compose.yml          # Containerized multi-service orchestration
├── backend/
│   ├── Dockerfile              # Backend container definition
│   ├── pyproject.toml          # UV project metadata & dependencies
│   ├── requirements.txt        # Frozen Python dependencies
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI entrypoint & CORS configuration
│   │   ├── config.py           # Application settings & environment variables
│   │   ├── data.py             # SQLite connection management
│   │   ├── schemas.py          # Pydantic request & response schemas
│   │   ├── selection.py        # Core latest-forecast-before-cutoff logic
│   │   ├── metrics.py          # MAE, RMSE, Bias, P90 safety margin, distributions
│   │   └── api/
│   │       ├── router.py       # API router aggregator
│   │       └── routes/
│   │           ├── health.py   # GET /api/health
│   │           ├── config.py   # GET /api/config
│   │           ├── forecast.py # GET /api/forecast, GET /api/forecast/range
│   │           └── metrics.py  # GET /api/metrics, /by-hour, /by-horizon
│   ├── scripts/
│   │   └── ingest.py           # Offline ingestion from Elexon BMRS API
│   ├── data/
│   │   └── elexon_jan2026.db   # Ingested SQLite database (1,488 actuals, 19,053 forecasts)
│   └── tests/
│       ├── test_selection.py   # Unit tests with handcrafted fixtures for edge cases
│       └── test_metrics.py     # Unit tests verifying metrics against hand computations
└── frontend/
    ├── Dockerfile              # Frontend container definition
    ├── package.json            # Node dependencies (Next.js, shadcn/ui, Recharts)
    ├── app/
    │   ├── layout.tsx          # Root layout with ThemeProvider & TooltipProvider
    │   ├── page.tsx            # Trading dashboard page with all states
    │   └── globals.css         # Theme styling & chart color tokens
    ├── components/
    │   ├── Header.tsx          # Header with source badge & ThemeToggle
    │   ├── ThemeToggle.tsx     # Light/Dark mode switcher
    │   ├── ControlsBar.tsx     # Single/Range mode, date picker (2 Jan-1 Feb 2026), cutoff badge
    │   ├── TakeawayAlert.tsx   # Actionable buyer takeaway alert
    │   ├── KpiCards.tsx        # 5 KPI cards (MAE, RMSE, Bias, P90 margin, NMAE)
    │   ├── ForecastChart.tsx   # ComposedChart: Actual vs Forecast + P90 error band
    │   ├── ErrorByHourChart.tsx# Hourly error distribution bar chart (0-23 UTC)
    │   ├── ErrorByHorizonChart.tsx # Lead time error decay chart (16h-40h)
    │   ├── SlotTable.tsx       # Collapsible table with sortable columns & CSV download
    │   └── ui/                 # shadcn/ui primitives (Card, Table, Popover, etc.)
    └── lib/
        ├── types.ts            # TypeScript interfaces
        ├── mock.ts             # Deterministic fallback generator
        └── api.ts              # Normalized API client
```

---

## 3. How to Run

### Option A: Using Docker (Recommended)

```bash
docker-compose up --build
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Running Locally Without Docker

#### 1. Backend (FastAPI)
```bash
cd backend

# Create and activate virtual environment
uv sync
# OR: python -m venv .venv && source .venv/bin/activate (or .\.venv\Scripts\activate on Windows)
# pip install -r requirements.txt

# (Optional) Run data ingestion if database is fresh:
python scripts/ingest.py

# Run unit tests:
pytest

# Start FastAPI server:
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend (Next.js)
```bash
cd frontend

# Install packages
npm install

# Build & run production or start dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 4. API Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check with server timestamp |
| `GET` | `/api/config` | Configured cutoff time (`09:00`), timezone (`UTC`), data date range |
| `GET` | `/api/forecast?delivery_date=YYYY-MM-DD` | Day-ahead forecast vs actual generation for 48 half-hour slots |
| `GET` | `/api/forecast/range?start=&end=` | Multi-day forecast vs actuals for a date range |
| `GET` | `/api/metrics?start=&end=` | MAE, RMSE, bias, P50/P90/P95 error percentiles, normalized MAE (%) |
| `GET` | `/api/metrics/by-hour` | MAE and RMSE grouped by delivery hour (0–23 UTC) |
| `GET` | `/api/metrics/by-horizon` | Error decay grouped by forecast lead time (hours between publish and delivery) |

---

## 5. Assumptions & Modeling Decisions

1. **Cutoff Time**: Defaulted to `09:00 UTC` on $D-1$. Day-ahead spot auctions on EPEX SPOT and Nord Pool close between 09:20 and 09:50 UK time, giving trading desks a 20–50 minute window to formulate order curves.
2. **Timezone**: All timestamps are stored and evaluated in **UTC**. In January, Great Britain operates on Greenwich Mean Time (GMT = UTC), which eliminates daylight saving ambiguities.
3. **Missing Forecasts**: When NESO does not publish a forecast for an individual settlement slot before the cutoff, the slot is marked as `missing` (`forecast = null`). It is rendered as a gap on the chart with a warning indicator.
4. **Data Window**: January 2026 decisions start on **1 Jan 2026** (for delivery on **2 Jan 2026**) and conclude on **31 Jan 2026** (for delivery on **1 Feb 2026**).

---

## 6. Known Limitations & Next Steps

- **National Aggregate Only**: Currently tracks total GB national wind. Future iterations will incorporate zonal nodal breakdowns and embedded vs. transmission-connected generation.
- **Deterministic Forecasts**: Evaluates point forecasts. Incorporating probabilistic ensembles (P10/P50/P90 distributions from weather models) would enhance hedge optimization.
- **Intra-Day Rescheduling**: Evaluates day-ahead auction positions. A natural extension is continuous intra-day gate closure tracking (1 hour prior to settlement).

---

## 7. AI Tool Disclosure

In accordance with project guidelines, AI tools (Google DeepMind Antigravity) were utilized for:
- Accelerating frontend component composition using `shadcn/ui` and `Recharts`.
- Drafting unit test fixtures and SQLite schema definitions.
- Formatting API schemas and OpenAPI documentation.
All selection logic, metric computations, and API contracts were explicitly verified with unit test suites against official Elexon BMRS dataset specifications.
