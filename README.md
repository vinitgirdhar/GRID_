<p align="center">
  <img src="https://img.shields.io/badge/GRID-Urban%20Mobility%20Intelligence-facc15?style=for-the-badge&labelColor=0f172a" alt="GRID Badge" />
</p>

<h1 align="center">GRID</h1>

<p align="center">
  <strong>AI-Powered Urban Mobility Intelligence for Rideshare Drivers & Fleet Operators</strong>
</p>

<p align="center">
  An intelligent platform that combines machine learning demand forecasting, real-time drowsiness detection, voice-controlled navigation, and driver wellness monitoring — purpose-built for the streets of New York City.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/XGBoost-FF6600?style=flat-square&logo=xgboost&logoColor=white" />
  <img src="https://img.shields.io/badge/MediaPipe-4285F4?style=flat-square&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=google&logoColor=white" />
</p>

---

## Why GRID Exists

Rideshare and taxi drivers make hundreds of micro-decisions every shift — *where to go next, which ride to accept, when to take a break, whether conditions are right to keep driving.* These decisions directly impact their earnings, safety, and well-being, yet most drivers operate with zero data-driven guidance.

**GRID exists to give every driver the intelligence of a fleet operations center, right on their phone.**

It's not just a dashboard. It's an AI co-pilot that understands the city's demand patterns, watches for signs of driver fatigue, speaks to the driver hands-free, and proactively recommends when to push for earnings and when to step back for safety.

---

## What GRID Does

GRID serves **two user roles** — each with a purpose-built experience:

### 🚕 For Drivers — A Hands-Free Intelligence Co-Pilot

| Feature | What It Does | Why It Matters |
|---|---|---|
| **Intelligence Dashboard** | Live KPIs showing peak zone demand, recommended zones, active forecast hour, and weather signals — all updated in real time. | Drivers see exactly where the money is *right now*, not 30 minutes ago. |
| **Go For Ride** | Generates smart ride opportunity cards from the live hotspot feed, with AI recommendations (Accept/Consider/Reject), fare estimates, traffic, weather, and directional context. | Every ride decision is backed by data, not guesswork. |
| **Destination Mode** | Filters ride opportunities to routes heading toward the driver's desired direction (home, airport, downtown), with a live map and route visualization. | Drivers heading home at the end of a shift can still earn on profitable rides along the way. |
| **Demand Prediction (Where Should I Go Next)** | On-demand XGBoost forecasts by zone and time — shows predicted trip count, demand level, confidence score, and the model used. | Answers the single most important driver question: *"Where should I position myself?"* |
| **Live Drowsiness Camera** | Uses the device camera + MediaPipe Face Mesh to track eye aspect ratio (EAR), blink patterns, yawning, and jaw-open blendshapes in real time. Triggers visual + audio alarms. | Fatigue is the #1 preventable cause of driver accidents. GRID catches it before it becomes dangerous. |
| **Voice Copilot (GRID Pilot)** | Hands-free voice assistant powered by Gemini AI. Understands natural language queries about demand, navigation, and ride strategy. Falls back to offline voice commands when connectivity drops. | Drivers can't be looking at screens while driving. Voice is the only safe interaction model. |
| **Driver Wellness (SafetyZen)** | Monitors cumulative drive time, recommends breaks with a proactive modal, and offers guided resonance breathing exercises with an animated orb visualization. | Wellness isn't a nice-to-have — burned-out drivers earn less and drive unsafely. |
| **Eco Mode** | Toggleable fuel-efficient routing that estimates CO₂ savings. | Sustainability meets savings — lower fuel costs, lower emissions. |
| **Offline-First Architecture** | Queues API calls locally when connectivity drops, auto-syncs when back online, and serves cached hotspot data. Voice commands work offline. | NYC has dead zones. A driver tool that breaks when you enter a tunnel is useless. |

### 📊 For Admins — Fleet Operations Intelligence

| Feature | What It Does | Why It Matters |
|---|---|---|
| **Admin Dashboard** | City-wide forecast volumes, peak zone analysis, hourly demand curves, top live zones, and active driver roster with tier badges. | Fleet operators need the 30,000-foot view to allocate resources. |
| **Data Insights** | Exploratory analytics on ride patterns, borough distribution, and demand trends. | Data-driven fleet strategy, not gut decisions. |
| **Weather Insights** | Live weather data tied to demand impact scores — shows how atmospheric conditions shift ride volume. | Weather is one of the strongest demand signals in urban mobility. |
| **Model Performance** | Side-by-side comparison of three XGBoost model variants (Base, Event-Enriched, Improved) with RMSE, R², feature importance, and training metadata. | Transparency into the ML pipeline — operators can see *why* predictions work. |
| **Driver Management** | View and manage driver roster, performance tiers, and borough distribution. | Fleet oversight at a glance. |

---

## Key Technical Features

### 🤖 Machine Learning Pipeline
The prediction engine is built on **XGBoost** trained on NYC taxi trip data. Features include temporal signals (hour, day, rush-hour flags), lagged demand (1h, 24h, 168h), rolling statistics, zone-specific multipliers, and distance/fare profiles. The backend serves three model variants so operators can compare improvements over the baseline.

### 🧠 Gemini AI Voice Copilot
The **GRID Pilot** voice assistant uses the Web Speech API for recognition and synthesis, with Gemini 2.0 Flash as the AI brain. It receives real-time GRID data context (hotspots, drowsiness state, demand) in its system prompt, enabling contextually aware spoken responses. When Gemini is unavailable, it falls back to a local keyword-based intent system that still handles core commands.

### 👁️ Real-Time Drowsiness Detection
Uses **MediaPipe Face Landmarker** running entirely in the browser — no server-side processing needed. Tracks 468 facial landmarks at video framerate, computes Eye Aspect Ratio (EAR) for blink/closure detection, mouth ratio for yawn detection, and `jawOpen` blendshape scores. Persistent closure triggers escalating alerts with audio buzzer and full-screen warning overlay. All telemetry is synced to the backend for fleet monitoring.

### 📡 Offline-First Design
Built with an IndexedDB-backed sync queue. When the driver loses connectivity, API calls are intercepted and queued locally. When connectivity returns, the sync engine replays them in order. Cached hotspot snapshots ensure ride opportunities are still visible. Voice commands degrade gracefully to a local command set (start ride, end ride, where to go).

### 🗺️ Live Map Integration
Interactive Leaflet maps with demand heatmap overlays, route visualization for Destination Mode, and ride pins with fare labels. Supports offline tile caching.

### 💓 Proactive Wellness System
Backend-accelerated wellness simulation tracks cumulative drive time with a visual "water fill" heart animation. When the driver completes a driving cycle, a break recommendation modal appears proactively. Guided breathing exercises (4-4-6 resonance pattern) help drivers reset physiologically.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React 19 + Vite)    │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Driver   │  │  Admin   │  │  Voice       │  │
│  │  App      │  │  App     │  │  Copilot     │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │          │
│  ┌────┴──────────────┴───────────────┴───────┐  │
│  │        Offline Service + Sync Engine       │  │
│  │          (IndexedDB Queue)                 │  │
│  └────────────────────┬──────────────────────┘  │
└───────────────────────┼─────────────────────────┘
                        │
                   HTTP / REST
                        │
┌───────────────────────┼─────────────────────────┐
│              Backend (FastAPI + Python)          │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ XGBoost  │  │ Hotspot  │  │  Gemini AI   │  │
│  │ Predict  │  │ Engine   │  │  Copilot     │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Weather  │  │ Wellness │  │  Drowsiness  │  │
│  │ Service  │  │ Tracker  │  │  Monitor     │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, Leaflet |
| **Backend** | Python, FastAPI, XGBoost, Pandas, Pydantic |
| **AI/ML** | XGBoost (demand forecasting), MediaPipe Face Landmarker (drowsiness), Gemini 2.0 Flash (copilot) |
| **APIs** | WeatherAPI (live weather), Web Speech API (voice recognition + synthesis) |
| **Offline** | IndexedDB sync queue, cached API responses, local voice command fallback |
| **Data** | NYC Taxi & Limousine Commission trip records |

---

## Getting Started

### Prerequisites

- **Node.js** (v18+)
- **Python** (v3.10+)
- **Gemini API Key** (for voice copilot)
- **WeatherAPI Key** (for live weather data)

### 1. Frontend

```bash
npm install
npm run dev
```

The app will be running at `http://localhost:3000`.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Environment Variables

Copy `.env.example` to `.env` and set:

```env
GEMINI_API_KEY=your_gemini_api_key
WEATHER_API_KEY=your_weatherapi_key
VITE_API_BASE_URL=http://localhost:8000/api
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/grid
```

### 4. ML Pipeline (Optional)

```bash
cd grid_ml
pip install -r requirements.txt
jupyter notebook
```

Open the notebooks in `grid_ml/notebooks/` for data exploration and model training.

---

## Project Structure

```
GRID/
├── src/                        # React frontend
│   ├── components/
│   │   ├── pages/              # Route-level page components
│   │   │   ├── DriverOverview  # Driver intelligence dashboard
│   │   │   ├── GoForRide       # Live ride opportunity feed
│   │   │   ├── DemandPrediction# Zone-level XGBoost forecasts
│   │   │   ├── DriverPerformance# Driver performance analytics
│   │   │   ├── Overview        # Admin fleet dashboard
│   │   │   ├── DataInsights    # Exploratory analytics
│   │   │   ├── WeatherInsights # Weather-demand correlation
│   │   │   └── ModelPerformance# ML model comparison
│   │   ├── LiveDrowsinessCamera# Real-time face tracking + alerts
│   │   ├── VoicePilot          # Gemini-powered voice assistant
│   │   ├── SafetyZen           # Wellness + breathing exercises
│   │   ├── MapComponent        # Leaflet map with demand overlay
│   │   └── DrowsinessMonitor   # Sidebar drowsiness status widget
│   ├── services/               # API, offline, prediction, sync
│   ├── App.tsx                 # Shell with dual-role routing
│   └── OfflineContext.tsx      # Connectivity + sync state
├── backend/                    # FastAPI ML backend
│   ├── main.py                 # All API endpoints + Gemini copilot
│   ├── config.py               # Settings + paths
│   ├── schemas.py              # Pydantic response models
│   └── models.py               # Database models
├── grid_ml/                    # ML pipeline
│   ├── data/                   # Raw + processed datasets
│   ├── models/                 # Trained XGBoost models + metadata
│   ├── notebooks/              # Jupyter exploration
│   ├── src/                    # Feature engineering + training
│   └── outputs/                # Forecasts, hotspots, recommendations
└── android/                    # Capacitor Android wrapper
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.
