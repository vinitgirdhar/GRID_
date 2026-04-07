# GRID Driver UX Overhaul + Goal-Based Routing

## Overview

Two parallel streams of improvements to the GRID driver-facing UI:

1. **UX Clarity Overhaul** — Redesign the driver dashboard so that a non-technical NYC taxi driver understands every piece of information instantly, without explanation. The rule: *if a reviewer (non-technical) can't understand it, fix it.*

2. **Goal-Based Routing** — A new "Plan My Shift" feature where a driver inputs their available time budget and earnings target, and the AI outputs the optimal sequence of zones to visit during that window.

Both streams have a critical constraint: **charts are NOT removed** — they are hidden behind an "Advanced" toggle that any driver can tap to explore in-depth data.

---

## User Review Required

> [!IMPORTANT]
> **Benchmark for UX clarity**: Every label, badge, number, and button shown to driver users must pass this test: *"Could a NYC cab driver with no tech background understand this at a glance?"*
> All technical jargon (`XGBoost`, `Demand Lift`, `Horizon Lift`, `Base Zone`, `Prediction Formula Breakdown`) is either completely replaced with plain English or hidden behind the Advanced toggle.

> [!WARNING]
> **Charts stay** — the existing Recharts area/bar charts in `DriverOverview.tsx` (`3 Hour Trend`, `Prediction Formula Breakdown`) are preserved. They are moved inside a collapsible "Advanced Details" panel, **not deleted**.

> [!IMPORTANT]
> **Goal-Based Routing is frontend-computed first**: The backend `/api/v1/goal-route` endpoint will be added to `backend/main.py` and use the *already loaded* hotspot/forecast data to compute zone sequences. The frontend also has a full deterministic mock fallback — so if the backend is down, the feature still works.

---

## Proposed Changes

---

### 1. DriverOverview.tsx — UX Clarity + Advanced Toggle

#### [MODIFY] `src/components/pages/DriverOverview.tsx`

**Current problems:**
- KPI labels: `"Peak Zone Demand"`, `"Active Forecast Hour"`, `"Weather Signal"` — meaningless to a driver
- Section title `"Prediction Formula Breakdown"` with `"Base Zone"`, `"Weather Lift"`, `"Event Lift"`, `"Horizon Lift"` — pure ML jargon
- The 3-hour trend chart title says `"3 Hour Trend"` (no context for WHY it matters)
- The cards say `"Demand Intelligence"`, `"Weather Intelligence"`, `"Event Intelligence"` — sounds like a flight manual

**Changes:**

**A. KPI Cards — Plain English Labels**

| Old Label | New Label | Old Sub-text | New Sub-text |
|---|---|---|---|
| `Peak Zone Demand` | `Busiest Area Right Now` | zone name | `"Best place to be"` |
| `Recommended Zones` | `Hot Zones Where to Go` | `Morning/Evening Window` | active count with emoji 🔥 |
| `Active Forecast Hour` | `Best Time to Drive` | `Peak: X rides` | `"Earnings peak at X:00"` |
| `Weather Signal` | `Weather Boost` | borough | `Rainy = more rides` hint |

**B. Intelligence Cards — Plain English**

| Old Title | New Title | Old Badge | New Badge |
|---|---|---|---|
| `Demand Intelligence` | `🔥 Where Money Is` | `Critical` | `HIGH DEMAND` |
| `Weather Intelligence` | `☁️ Weather Effect` | `Active Alert` | colored weather chip |
| `Event Intelligence` | `📅 Nearby Events` | `Surge Risk` | `EVENT BOOST` |

All sub-labels inside these cards also simplified (e.g., `"Predicted Rides"` → `"Expected pickups"`, `"Time Window"` → `"Best time to be there"`).

**C. Advanced Toggle**

A single `<AdvancedToggle>` button placed near the top of the page (right side, below LIVE/OFFLINE button) labeled:
```
🔬 Deep Data  ▾ / ▴
```

When OFF (default — *Simple Mode*):
- The **Prediction Formula Breakdown** bar chart is hidden entirely
- The **3 Hour Trend** area chart inside the Demand card is hidden
- The inline `formulaData` / `trendData` bars are collapsed

When ON (*Advanced Mode*):
- Both charts slide in with animation
- A badge appears: `Advanced data is showing — charts & raw numbers`

Implementation: `const [showAdvanced, setShowAdvanced] = useState(false)` at the top of the component. Wrap chart sections in `{showAdvanced && (...)}`

**D. Missed Opportunity Feed**

The `<MissedOpportunityFeed>` title will be shown as `"Trips You Missed Nearby"` above the feed (currently has no human label at page level).

---

### 2. DemandPrediction.tsx — UX Simplification

#### [MODIFY] `src/components/pages/DemandPrediction.tsx`

**Current problems:**
- Title: `"Where Should I Go Next?"` — OK
- Sub-title: `"Live XGBoost demand forecasts — auto-targeting the highest-demand zone"` — technical jargon
- `"Forecast Parameters"` panel label — what is a "forecast parameter" to a driver?
- Output shows `"Predicted Demand: 247 Trips"` — good! But `"Model Confidence"`, `"Serving Improved Model for..."` — jargon
- `"Processing XGBoost Inference"` loading text — pure API speak

**Changes:**

| Old Text | New Text |
|---|---|
| `"Live XGBoost demand forecasts..."` | `"AI tells you where rider demand is highest right now"` |
| `"Forecast Parameters"` | `"Set Your Search"` |
| `"Target Date"` | `"When are you driving?"` |
| `"Hour of Day"` | `"What time?"` |
| `"Target Zone"` | `"Pick a neighborhood"` |
| `"Generate Forecast"` | `"Find Best Zone"` |
| `"Processing XGBoost Inference"` | `"AI is thinking... 🤔"` |
| `"Predicted Demand"` header | `"Expected Pickups"` |
| `"Model Confidence"` | `"AI Confidence"` |
| `"Serving Improved Model for..."` | `"GRID's AI checked {borough} for you"` |

The `<SmartStrategyCard>` title `"AI Smart Strategy"` stays — it's already clear. Sub-text `"Event-driven recommendation"` → `"Based on live events nearby"`.

---

### 3. NEW: Goal-Based Routing — "Plan My Shift" Feature

This is an entirely new page/component that plugs into the existing nav.

#### [NEW] `src/components/pages/PlanMyShift.tsx`

**What it does:**
A driver enters:
1. **Time Budget** — slider or quick select: `1h / 2h / 3h / 4h / Custom`
2. **Earnings Target** — e.g., `$50`, `$80`, `$120`, `$150`, or custom input

After hitting **"Plan My Shift"**, the AI outputs:
- A **numbered zone sequence** (e.g., #1 → Times Square → #2 → Grand Central → #3 → Midtown East)
- **Per-zone stats in plain English**: `"~14 pickups, ~$28 earned, 45 min"`
- **Total projected earnings** vs. target (progress bar)
- A **map showing the route** between zones in sequence
- **Plain-language AI summary**: `"With 3 hours and a $80 target, start at Times Square for the surge, then move to Grand Central before 6 PM, and wrap up in Midtown East for the evening rush."`

**Inputs to the algorithm:**
- `timeBudgetHours` — user input
- `earningsTarget` — user input
- `hotspots` — from existing `/api/v1/hotspots`
- `forecast` — from existing `/api/v1/forecast`

**Algorithm (frontend-computed greedy optimizer):**
```
1. Score each hotspot zone by: (predicted_demand × fare_multiplier) / travel_time_minutes
2. Sort zones by score descending
3. Greedily pick the top zone, add to sequence, deduct travel_time from budget
4. Repeat until time budget is exhausted
5. Estimate earnings per zone as: predicted_demand × 0.12 (same formula as GoForRide.tsx)
6. Show cumulative earnings progression vs. target
```

**Backend endpoint (optional enhancement):**
`POST /api/v1/goal-route` with body `{ time_hours: 3, earnings_target: 80 }` — returns `GoalRouteResponse` with zone sequence. This will use the already-loaded hotspot + forecast data in `app.state`. Frontend falls back to its own calculation if backend is unavailable.

#### UI Wireframe

```
┌─────────────────────────────────────┐
│  ⏱ Plan My Shift                    │
│  Tell us your time & money goal     │
│                                     │
│  🕐 How long are you driving?        │
│  [1h] [2h] [3h] [4h] [Custom]       │
│                                     │
│  💰 How much do you want to earn?   │
│  [  $50  ] [  $80  ] [  $120  ]     │
│  Or type amount: [$____]            │
│                                     │
│  [🚀 Plan My Shift]                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ✅ Your Shift Plan                  │
│  Projected: $87  Target: $80  ✓     │
│  ████████████████░ 91%              │
│                                     │
│  #1 → Times Square     45 min      │
│       ~14 pickups · ~$28           │
│  #2 → Grand Central    30 min      │
│       ~10 pickups · ~$22           │
│  #3 → Midtown East     45 min      │
│       ~12 pickups · ~$25           │
│                                     │
│  [Show on Map]                      │
│                                     │
│  💬 "Start at Times Square for the  │
│     surge, then swing to Grand     │
│     Central before 6 PM..."        │
└─────────────────────────────────────┘
```

---

### 4. Backend — New Goal Route Endpoint

#### [MODIFY] `backend/main.py`

Add `GoalRouteRequest` and `GoalRouteResponse` to schemas.py, then add:

```python
@app.post(f"{settings.api_prefix}/goal-route", response_model=GoalRouteResponse)
def compute_goal_route(request: GoalRouteRequest) -> GoalRouteResponse:
    ...
```

**Algorithm:**
1. Load `app.state.hotspots` (active period) and `app.state.forecast`
2. Score each active hotspot zone: `score = predicted_demand × multiplier / 15` (15 min avg travel time between zones)
3. Greedily pick top zones until `time_budget_minutes` is exhausted
4. For each zone estimate: `estimated_trips ≈ predicted_demand × 0.08`, `estimated_earnings = estimated_trips × avg_fare`
5. Return ordered `GoalRouteResponse` with `zones`, `projected_earnings`, `summary_text`, `meets_target`

#### [MODIFY] `backend/schemas.py`

```python
class GoalRouteRequest(BaseModel):
    time_hours: float = Field(ge=0.5, le=12)
    earnings_target: float = Field(ge=0, le=1000)

class GoalRouteZone(BaseModel):
    rank: int
    zone_id: str
    zone_name: str
    borough: str
    lat: float
    lng: float
    estimated_minutes: int
    estimated_trips: int
    estimated_earnings: float

class GoalRouteResponse(BaseModel):
    generated_at: datetime
    time_budget_hours: float
    earnings_target: float
    projected_earnings: float
    meets_target: bool
    zones: list[GoalRouteZone]
    summary_text: str
```

---

### 5. API Service — Goal Route Endpoint

#### [MODIFY] `src/services/apiService.ts`

Add:
```typescript
export interface GoalRouteRequest {
  time_hours: number;
  earnings_target: number;
}

export interface GoalRouteZone { ... }
export interface GoalRouteResponse { ... }

export async function computeGoalRoute(payload: GoalRouteRequest): Promise<GoalRouteResponse> {
  return fetchJson<GoalRouteResponse>('/goal-route', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, () => mockComputeGoalRoute(payload));
}
```

---

### 6. Navigation Integration

#### [MODIFY] `src/App.tsx`

`PlanMyShift` is a driver-only feature. Add it to the driver nav alongside `DriverOverview`, `GoForRide`, `DemandPrediction`. Nav entry label: **"Plan Shift"** with a `Target` icon from lucide-react.

A new case for `'plan-shift'` will be added to the driver nav items and page renderer.

---

### 7. Mock Service — Goal Route Fallback

#### [MODIFY] `src/services/mockApi.ts`

Add `mockComputeGoalRoute(payload)` that uses hardcoded zone data (Times Square, Grand Central, Penn Station, etc.) to compute a plausible zone sequence. This ensures the feature is 100% functional even when backend is offline.

---

## Open Questions

> [!IMPORTANT]
> **Q1: Where does "Plan My Shift" appear in the nav?**
> Currently drivers have: Intelligence · Go For Ride · Demand · SafetyZen. Should "Plan Shift" replace "Demand Prediction" for driver users, or sit alongside it? **Recommendation**: Add it alongside as a 5th driver tab with icon `Target` from lucide-react.

> [!IMPORTANT]
> **Q2: Earnings estimate basis**
> The fare estimate uses `fare = 12 + (predicted_demand × 0.12)` from `GoForRide.tsx`. For goal-routing, should we use this same formula, or apply the `avg_fare` from `ZONE_CATALOG` in the backend? Recommendation: use the backend `avg_fare` for more accurate zone-level estimates.

> [!NOTE]
> **Q3: Travel time between zones**
> For the greedy zone sequencing, a flat **15-minute transit time** between any two zones is assumed (consistent with NYC driving). This can be made distance-based in phase 2. Is the flat estimate OK for now?

---

## Verification Plan

### Automated Tests
- Visual: `npm run dev` → open driver dashboard → confirm no jargon visible in default (non-advanced) mode
- Advanced toggle: click "Deep Data" → charts animate in → click again → charts collapse
- Plan My Shift: select 2h / $80 → click "Plan My Shift" → zone sequence renders with earnings bar
- Backend offline: kill uvicorn → refresh → Plan My Shift still works via mock fallback

### Manual Verification
1. Share with non-technical reviewer — confirm they understand all labels without explanation
2. Confirm charts still exist and accessible via Advanced toggle (not deleted)
3. Confirm existing `DriverOverview`, `GoForRide`, `DemandPrediction` are not broken
