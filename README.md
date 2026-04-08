<p align="center">
  <img src="https://img.shields.io/badge/GRID-Urban%20Mobility%20Intelligence-facc15?style=for-the-badge&labelColor=0f172a" alt="GRID Badge" />
</p>

<h1 align="center">GRID</h1>

<p align="center">
  <strong>AI-Powered Urban Mobility Intelligence for Rideshare Drivers & Fleet Operators</strong>
</p>

<p align="center">
  An intelligent platform that combines machine learning demand forecasting, real-time drowsiness detection, voice-controlled navigation, and driver wellness monitoring — purpose-built for the streets of New York City with a <strong>driver-first approach</strong>.
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

But data is only useful if it’s understandable. GRID’s driver experience is designed to be **simple, intuitive, and jargon-free**. We target NYC taxi drivers, not technical users. If a driver can’t understand a card in one second while sitting in traffic, we fix it.

---

## What GRID Does

GRID serves **two user roles** — each with a purpose-built experience:

### 🚕 For Drivers — Your Hands-Free AI Copilot

| Feature | What It Does | Why It Matters |
|---|---|---|
| **Dashboard** | Displays the "Busiest Area Right Now," "Hot Zones," and "Best Time to Drive" in plain English. No jargon, just results. | Drivers see exactly where the money is *right now*. |
| **Go For Ride** | Generates smart ride cards from live hotspots with AI recommendations (Accept/Consider/Reject), fare estimates, and directional context. | Every ride decision is backed by data, not guesswork. |
| **Plan My Shift** | **NEW!** Input your time budget and earnings goal. The AI calculates the optimal zone sequence to hit your targets within your window. | Automated shift planning based on real-time and historical demand. |
| **Where Money Is** | Formerly "Demand Prediction." Simple 3-day scrollable slider to see when and where demand is peaking without using a complex calendar. | Answers the most important question: *"Where should I position myself?"* |
| **GRID Copilot Strategy** | A refined, compact AI dispatch card providing real-time "Directives" (e.g. "Navigate to Midtown") based on live events and ML insights. | Proactive strategy coaching that doesn't clutter the screen. |
| **Performance Analytics** | Clean, optimized shift summary with integrated KPIs (Drive Time, Total Earnings, Tip Avg) and a "Deep Data" toggle for charts. | Track how you worked today without the "flight control manual" complexity. |
| **Missed Opportunities** | Tracks skipped rides and provides a **Dynamic Shift Insight** summary: *"Shift Insight: You skipped 4 rides ($45 lost) but made 2 smart passes."* | Real-time learning from past decisions to optimize future earnings. |
| **Drowsiness Camera** | Real-time face tracking (MediaPipe) that alerts the driver if they show signs of fatigue or distracton. | Fatigue is dangerous. GRID catches it before it becomes an accident. |
| **Wellness (SafetyZen)** | Monitors cumulative drive time and guides the driver through resonance breathing exercises to reduce stress. | Burned-out drivers drive unsafely. SafetyZen keeps you sharp. |

### 📊 For Admins — Fleet Operations Intelligence

| Feature | What It Does | Why It Matters |
|---|---|---|
| **Fleet Overview** | City-wide forecast volumes, peak zone analysis, and hourly demand curves. | Fleet operators need the 30,000-foot view to allocate resources. |
| **Data Insights** | Exploratory analytics on ride patterns, borough distribution, and demand trends. | Data-driven fleet strategy, not gut decisions. |
| **Weather Insights** | Live weather data tied to demand impact scores. | Weather is one of the strongest demand signals in urban mobility. |
| **Model Performance** | Side-by-side comparison of three XGBoost model variants (Base, Event-Enriched, Improved) with RMSE and R². | Transparency into the ML pipeline — see *why* predictions work. |

---

## 🛠 Project Refinements

### 1️⃣ Simplified UI (UX Clarity Overhaul)
We have removed all technical jargon. "XGBoost demand forecasts" are now "Expected Pickups." We consolidated floating KPI boxes into streamlined headers and integrated them into the "Live Shift Tracker" for a premium, integrated look.

### 2️⃣ Advanced "Deep Data" Toggle
While we prioritize simplicity, we didn't remove the charts. Drivers who want in-depth data (3-Hour Trends, Prediction Breakdowns) can tap the **Deep Data** toggle to expand the Recharts visualizations.

### 3️⃣ 3-Day Date Slider
Replaced the traditional calendar picker with a sleek horizontal slider. Drivers can switch between "Today," "Tomorrow," and the next two days in one tap — perfectly optimized for a smartphone screen.

### 4️⃣ GRID Copilot Strategy
A complete redesign of the Smart Strategy card. It now looks like a professional navigation instrument with pulsing "Active" indicators, navigation directives, and a highly compact layout to save screen real estate.

---

## Technical Features

### 🤖 Machine Learning
Built on **XGBoost** trained on NYC taxi trip records. Features include temporal signals, lagged demand (1h, 24h, 168h), and zone-specific multipliers. The backend serves three model variants for performance comparison.

### 🧠 Gemini AI Voice Copilot
Uses the Web Speech API + Gemini 2.0 Flash. It receives real-time GRID data context (hotspots, drowsiness state, demand) to answer natural language queries hands-free while driving.

### 👁️ Real-Time Drowsiness Detection
Uses **MediaPipe Face Landmarker** running entirely in the browser. Tracks EAR (Eye Aspect Ratio) and `jawOpen` blendshapes to trigger escalating alarms (audio buzzer + full-screen overlay) locally on the device.

---

## Getting Started

### 1. Frontend
```bash
npm install
npm run dev
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.
