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
                                        │ ingest.py (&fuelType=WIND)
                                 Elexon BMRS API
```

### Core Logic & Rules
- **Decision Timing**: Bids in Great Britain day-ahead power auctions (EPEX SPOT / Nord Pool) close between 09:20 and 09:50 UK time. Decisions are evaluated against a **09:00 UK time (UTC) cutoff on D-1**.
- **Authentic Hourly Resolution**: National Grid ESO publishes national wind forecasts (`WINDFOR`) at hourly resolution. Elexon metered actuals (`FUELHH`) are half-hourly. The system computes the true hourly actual generation by averaging the two 30-minute settlement periods in that hour:
  $$\text{Actual}_{\text{Hour}} = \frac{SP_{2H-1} + SP_{2H}}{2}$$
  This avoids synthetic data interpolation and prevents statistical double-counting.
- **Forecast Selection**: For each target hourly slot $T$ on delivery day $D$, the system selects $\max(\text{publishTime})$ where $\text{publishTime} \le \text{cutoff}(D-1)$.
- **Error Calculation**: $\text{Error} = \text{Forecast} - \text{Actual}$. Positive values indicate over-forecasting (requiring thermal replacement); negative values indicate under-forecasting.
- **Missing Forecast Handling**: Slots lacking a forecast published prior to cutoff are flagged explicitly as missing (`null`) without silent interpolation, and rendered with alert markers.
- **Delivery Scope**: Decisions evaluated throughout **January 2026** (delivery window: 2 Jan 2026 to 1 Feb 2026; 744 true hourly delivery slots).

---

## 2. Repository Layout

```
.
├── PLAN.md                     # Architecture specification & roadmap
├── README.md                   # System documentation & setup guide
├── docker-compose.yml          # Containerized multi-service orchestration
├── backend/
│   ├── .gitignore              # Python/FastAPI ignore rules
│   ├── Dockerfile              # Backend container definition
│   ├── pyproject.toml          # UV project metadata & dependencies
│   ├── requirements.txt        # Frozen Python dependencies
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI entrypoint & CORS configuration
│   │   ├── config.py           # Application settings & environment variables
│   │   ├── data.py             # SQLite connection management
│   │   ├── schemas.py          # Pydantic request & response schemas
│   │   ├── selection.py        # Core latest-forecast-before-cutoff logic (hourly)
│   │   ├── metrics.py          # MAE, RMSE, Bias, P90 safety margin, distributions
│   │   └── api/
│   │       ├── router.py       # API router aggregator
│   │       └── routes/
│   │           ├── health.py   # GET /api/health
│   │           ├── config.py   # GET /api/config
│   │           ├── forecast.py # GET /api/forecast, GET /api/forecast/range
│   │           └── metrics.py  # GET /api/metrics, /by-hour, /by-horizon
│   ├── scripts/
│   │   └── ingest.py           # Ingestion from Elexon BMRS API with server-side fuelType=WIND
│   ├── data/
│   │   └── elexon_jan2026.db   # Ingested SQLite database (1,488 actuals, 19,053 forecasts)
│   └── tests/
│       ├── test_selection.py   # Unit tests with handcrafted fixtures for edge cases
│       └── test_metrics.py     # Unit tests verifying metrics against hand computations
└── frontend/
    ├── .gitignore              # Next.js/Node ignore rules
    ├── Dockerfile              # Multi-stage frontend container definition
    ├── package.json            # Node dependencies (Next.js 16, shadcn/ui, Recharts)
    ├── app/
    │   ├── layout.tsx          # Root layout with ThemeProvider & TooltipProvider
    │   ├── page.tsx            # Trading dashboard page with all states
    │   └── globals.css         # Theme styling, CSS variables & custom chart tokens
    ├── components/
    │   ├── Header.tsx          # Header with source badge & ThemeToggle
    │   ├── ThemeToggle.tsx     # Light/Dark mode switcher (SSR-safe)
    │   ├── ControlsBar.tsx     # Single/Range mode, date picker (2 Jan-1 Feb 2026), cutoff badge
    │   ├── TakeawayAlert.tsx   # Actionable buyer takeaway alert (P90 margin + bias)
    │   ├── KpiCards.tsx        # 5 KPI cards (MAE, RMSE, Bias, P90 margin, NMAE)
    │   ├── ForecastChart.tsx   # ComposedChart: Actual vs Forecast + P90 error band
    │   ├── ErrorByHourChart.tsx# Hourly error distribution bar chart (0-23 UTC)
    │   ├── ErrorByHorizonChart.tsx # Lead time error decay chart (16h-40h)
    │   ├── SlotTable.tsx       # Collapsible table (24 hourly rows/page) & CSV export
    │   └── ui/                 # shadcn/ui primitives (Card, Table, Popover, etc.)
    └── lib/
        ├── types.ts            # TypeScript interfaces
        ├── mock.ts             # Deterministic fallback generator (24 hourly slots)
        └── api.ts              # Normalized API client with offline fallback
```

---

## 3. How to Run

### Option A: Using Docker (Recommended)

Run both the FastAPI backend and Next.js frontend with a single command from the project root:

```bash
# Build and run containers
docker compose up --build

# Run in background (detached mode)
docker compose up --build -d
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

#### Docker Lifecycle & Management
```bash
# View live logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Stop containers
docker compose down

# Rebuild without cache (if dependencies are updated)
docker compose build --no-cache
```

> **Note on Build Caching**: Docker uses cached layers for package installation (`pip install` and `npm install`). Subsequent runs of `docker compose up --build` only rebuild your code changes and finish in seconds. The preloaded SQLite database is mounted via volume (`./backend/data:/app/data`), preserving data across container restarts.

---

### Option B: Running Locally Without Docker

#### 1. Backend (FastAPI)
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Re-ingest Elexon data if starting with a fresh database:
python scripts/ingest.py

# Run backend unit tests:
python -m pytest

# Start FastAPI server on port 8000:
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend (Next.js 16)
```bash
cd frontend

# Install dependencies
npm install

# Run Tailwind & ESLint checks (0 errors, 0 warnings):
npm run lint

# Build for production:
npm run build

# Start development server on port 3000:
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 4. API Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check with server UTC timestamp |
| `GET` | `/api/config` | Configured cutoff time (`09:00`), timezone (`UTC`), data date range |
| `GET` | `/api/forecast?delivery_date=YYYY-MM-DD` | Hourly day-ahead forecast vs actual generation (24 delivery slots) |
| `GET` | `/api/forecast/range?start=&end=` | Multi-day forecast vs actuals for any date range in January 2026 |
| `GET` | `/api/metrics?start=&end=` | MAE, RMSE, bias, P50/P90/P95 error percentiles, normalized MAE (%) |
| `GET` | `/api/metrics/by-hour` | MAE, RMSE, and bias grouped by delivery hour (0–23 UTC) |
| `GET` | `/api/metrics/by-horizon` | Error decay grouped by forecast lead time (hours between publish and delivery) |

---

## 5. Assumptions & Modeling Decisions

1. **Cutoff Time**: Defaulted to `09:00 UTC` on $D-1$. Day-ahead spot auctions on EPEX SPOT and Nord Pool close between 09:20 and 09:50 UK time, giving trading desks a 20–50 minute window to formulate order curves.
2. **Timezone**: All timestamps are stored and evaluated in **UTC**. In January, Great Britain operates on Greenwich Mean Time (GMT = UTC), which eliminates daylight saving ambiguities.
3. **Hourly Resolution & No Synthetic Data**: Actual generation is averaged from the two 30-minute metered settlement periods in each hour to align with National Grid's hourly forecast. No `:30` forecasts are fabricated or interpolated, ensuring metrics reflect genuine forecasting accuracy.
4. **Missing Forecasts**: When National Grid ESO does not publish a forecast for an individual delivery hour before the cutoff, the slot is marked as `missing` (`forecast = null`). It is rendered as a gap on the chart with a warning indicator and highlighted in the table.
5. **Data Window**: January 2026 decisions start on **1 Jan 2026** (for delivery on **2 Jan 2026**) and conclude on **31 Jan 2026** (for delivery on **1 Feb 2026**).
6. **Network Optimization**: The ingestion script passes `fuelType=WIND` directly in query parameters to Elexon's `/FUELHH/stream` endpoint, reducing download payload by ~90% and completing ingestion in under 2 seconds.
