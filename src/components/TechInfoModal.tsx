import { useEffect } from 'react';
import { X } from 'lucide-react';

export type TechInfoKey =
    | 'xgboost' | 'lightgbm' | 'gemini'
    | 'taxi' | 'transit' | 'weather' | 'events';

interface InfoSection {
    heading: string;
    rows: Array<[string, string]>;
}

interface InfoContent {
    title: string;
    tag: string;
    description: string;
    sections: InfoSection[];
    footnote?: string;
}

// All numbers come from grid_ml/models/*_metadata.json and the real data files —
// keep in sync if the models are ever retrained.
const CONTENT: Record<TechInfoKey, InfoContent> = {
    xgboost: {
        title: 'XGBoost Model',
        tag: 'Challenger Model',
        description:
            'Gradient-boosted decision trees trained to predict hourly taxi pickup demand per NYC zone. '
            + 'Benchmarked head-to-head against LightGBM; LightGBM won on test MAE, so XGBoost is kept as the comparison baseline.',
        sections: [
            {
                heading: 'Test-Set Results (111,906 unseen samples)',
                rows: [
                    ['RMSE', '10.14 trips/hr'],
                    ['MAE', '4.01 trips/hr'],
                    ['R² Score', '0.9790'],
                    ['MAPE', '23.4%'],
                ],
            },
            {
                heading: 'Training Setup',
                rows: [
                    ['Training rows', '528,009'],
                    ['Validation rows', '48,620'],
                    ['Features', '40 (temporal, transit, events, weather, demand lags)'],
                    ['Boosting rounds', '1,000 (early-stopped at 999)'],
                    ['Top signal', 'demand_lag_1h — 61% of importance'],
                ],
            },
        ],
        footnote: 'Verdict: solid, but LightGBM beat it on every test metric — not deployed to production.',
    },
    lightgbm: {
        title: 'LightGBM',
        tag: 'Production Model — Winner',
        description:
            'Gradient-boosted trees (LightGBM) — the production model behind every demand prediction in GRID: '
            + 'hotspots, 24-hour forecast, ride recommendations, and shift planning. Selected over XGBoost on test MAE.',
        sections: [
            {
                heading: 'Test-Set Results (111,906 unseen samples)',
                rows: [
                    ['RMSE', '9.33 trips/hr'],
                    ['MAE', '3.74 trips/hr'],
                    ['R² Score', '0.9822'],
                    ['MAPE', '20.6% → ~79.4% accuracy'],
                ],
            },
            {
                heading: 'Training Setup',
                rows: [
                    ['Training rows', '528,009'],
                    ['Validation rows', '48,620'],
                    ['Features', '17 (time-of-day, lags 1h/24h/168h, rolling stats, zone economics)'],
                    ['Boosting rounds', '1,000'],
                    ['Trained', 'April 2026'],
                    ['Selection metric', 'Lowest test MAE'],
                ],
            },
        ],
        footnote: 'The split is chronological — the model never sees the future during training, and the test set is touched exactly once.',
    },
    gemini: {
        title: 'Gemini API',
        tag: 'Voice Copilot — Hosted LLM',
        description:
            'GRID Copilot uses Google’s Gemini 2.0 Flash through the GenAI API. It is not trained by us — '
            + 'it receives live GRID context (top zones, demand levels, driver alertness) with every voice query and answers hands-free while driving.',
        sections: [
            {
                heading: 'How It Works',
                rows: [
                    ['Model', 'Gemini 2.0 Flash (Google GenAI API)'],
                    ['Input', 'Voice → Web Speech API → text + live GRID data context'],
                    ['Context injected', 'Hotspot zones, trips/hr, drowsiness status, time of day'],
                    ['Output', '1–3 spoken sentences; can trigger Destination Mode'],
                    ['Fallback', 'Local rule-based assistant when the API is unavailable'],
                ],
            },
        ],
    },
    taxi: {
        title: 'NYC Taxi Data',
        tag: 'Primary Training Dataset',
        description:
            'NYC Taxi & Limousine Commission (TLC) trip records, aggregated into hourly pickup counts per taxi zone. '
            + 'This is the ground truth the demand models learn from.',
        sections: [
            {
                heading: 'Dataset',
                rows: [
                    ['Source', 'NYC TLC open trip-record data'],
                    ['Total rows used', '688,535 zone-hours'],
                    ['Train / Val / Test', '528,009 / 48,620 / 111,906 (chronological split)'],
                    ['Target variable', 'Pickups per zone per hour'],
                    ['Derived features', 'Demand lags (1h, 24h, 168h), rolling means, rush-hour flags'],
                ],
            },
        ],
    },
    transit: {
        title: 'NYC Transit Data',
        tag: 'Feature Dataset — Static Export',
        description:
            'MTA subway data in GTFS format (stops, routes, trips, service calendars), joined to taxi zones. '
            + 'Zones with heavy transit activity behave differently — the models learn that.',
        sections: [
            {
                heading: 'Dataset',
                rows: [
                    ['Source', 'Metropolitan Transportation Authority (GTFS-style export)'],
                    ['Rows', '10,000 stop-route-trip records'],
                    ['Coverage', 'Stops, routes, trip schedules, service days per zone'],
                    ['Features built', 'transit_stop_count, transit_route_count, transit_trip_count, transit_score'],
                    ['Format', 'Static CSV — not a live API'],
                ],
            },
        ],
    },
    weather: {
        title: 'Weather API',
        tag: 'Live REST API',
        description:
            'Live weather from WeatherAPI.com. Used two ways: as model features during training, and as a live demand-impact signal on the dashboards.',
        sections: [
            {
                heading: 'Integration',
                rows: [
                    ['Source', 'WeatherAPI.com — current-conditions REST endpoint'],
                    ['Type', 'Live API (key-based), queried per zone coordinates'],
                    ['Model features', 'temperature, humidity, precipitation, windspeed, weathercode'],
                    ['Derived flags', 'is_rainy, is_hot, is_cold, is_windy'],
                    ['Live use', 'Weather Insights page + demand impact scores'],
                ],
            },
        ],
    },
    events: {
        title: 'NYC Event Data',
        tag: 'Feature Dataset — Static Export',
        description:
            'City events (concerts, sports, Broadway, festivals) with attendance estimates. '
            + 'A stadium letting out moves demand more than almost anything — the models see it coming.',
        sections: [
            {
                heading: 'Dataset',
                rows: [
                    ['Source', 'Curated NYC events export (CSV)'],
                    ['Rows', '519 events'],
                    ['Fields', 'Date, borough, category, estimated attendance, intensity score'],
                    ['Features built', 'event_count, total_attendance, max_intensity, attendance_score, has_sports, has_entertainment'],
                    ['Format', 'Static CSV — not a live API'],
                ],
            },
        ],
    },
};

export default function TechInfoModal({ infoKey, onClose }: { infoKey: TechInfoKey; onClose: () => void }) {
    const content = CONTENT[infoKey];

    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onEsc);
        return () => window.removeEventListener('keydown', onEsc);
    }, [onClose]);

    return (
        <div className="tim-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={content.title}>
            <style>{`
                .tim-overlay { position:fixed; inset:0; z-index:1000; background:rgba(5,5,20,0.78); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:20px; }
                .tim-card { width:100%; max-width:560px; max-height:85vh; overflow-y:auto; background:#0a0a1e; border:1px solid rgba(250,204,21,0.18); border-radius:18px; padding:28px; color:#e8edf3; box-shadow:0 24px 80px rgba(0,0,0,0.55); }
                .tim-tag { display:inline-block; font-size:0.65rem; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#facc15; background:rgba(250,204,21,0.1); border:1px solid rgba(250,204,21,0.25); border-radius:999px; padding:3px 10px; margin-bottom:10px; }
                .tim-title { font-size:1.35rem; font-weight:600; letter-spacing:-0.02em; margin-bottom:8px; }
                .tim-desc { font-size:0.85rem; font-weight:300; line-height:1.6; color:#94a3b8; margin-bottom:20px; }
                .tim-heading { font-size:0.68rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#64748b; margin:18px 0 8px; }
                .tim-row { display:flex; justify-content:space-between; gap:16px; padding:7px 0; border-bottom:1px solid rgba(148,163,184,0.1); font-size:0.82rem; }
                .tim-row dt { color:#94a3b8; font-weight:300; flex-shrink:0; }
                .tim-row dd { color:#e8edf3; font-weight:500; text-align:right; }
                .tim-foot { font-size:0.75rem; color:#64748b; font-style:italic; margin-top:16px; line-height:1.5; }
                .tim-close { position:sticky; float:right; top:0; background:rgba(148,163,184,0.1); border:none; border-radius:8px; padding:6px; color:#94a3b8; cursor:pointer; transition:all 0.15s; }
                .tim-close:hover { color:#e8edf3; background:rgba(148,163,184,0.2); }
            `}</style>
            <div className="tim-card" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="tim-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
                <span className="tim-tag">{content.tag}</span>
                <h2 className="tim-title">{content.title}</h2>
                <p className="tim-desc">{content.description}</p>
                {content.sections.map((section) => (
                    <div key={section.heading}>
                        <p className="tim-heading">{section.heading}</p>
                        <dl>
                            {section.rows.map(([label, value]) => (
                                <div className="tim-row" key={label}>
                                    <dt>{label}</dt>
                                    <dd>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                ))}
                {content.footnote && <p className="tim-foot">{content.footnote}</p>}
            </div>
        </div>
    );
}
