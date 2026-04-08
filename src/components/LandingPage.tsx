import React, { useEffect, useRef, useState } from 'react';
import {
    Github,
    Twitter,
    Linkedin,
    LayoutDashboard,
    BrainCircuit,
    BarChart3,
    Database,
    Filter,
    Cpu,
    Target,
    RefreshCw,
    Shield,
} from 'lucide-react';
import { initUnicornStudioBackground } from '../lib/unicornStudio';

// --- CUSTOM COMPONENTS ---

const MetricCounter = ({ target, prefix = '', suffix = '', decimals = 0, isMini = false }: {
    target: number; prefix?: string; suffix?: string; decimals?: number; isMini?: boolean;
}) => {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                let start: number | null = null;
                const duration = isMini ? 1500 : 2000;
                const delay = isMini ? 300 : 0;
                setTimeout(() => {
                    const step = (timestamp: number) => {
                        if (!start) start = timestamp;
                        const progress = Math.min((timestamp - start) / duration, 1);
                        const ease = 1 - Math.pow(1 - progress, 3);
                        setCount(target * ease);
                        if (progress < 1) window.requestAnimationFrame(step);
                    };
                    window.requestAnimationFrame(step);
                }, delay);
                observer.disconnect();
            }
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target, isMini]);

    let displayValue: string;
    if (isMini) {
        if (target < 10) displayValue = '$' + count.toFixed(1);
        else if (target >= 100) displayValue = Math.floor(count).toLocaleString();
        else displayValue = Math.floor(count) + '%';
    } else {
        if (target >= 1000) displayValue = Math.floor(count).toLocaleString();
        else displayValue = count.toFixed(decimals);
    }

    return <span ref={ref}>{prefix}{displayValue}{suffix}</span>;
};

const NodeGrid = () => {
    const activeIndices = [2, 5, 7, 9, 10, 14, 15, 17, 19, 21, 23];
    return (
        <div className="widget-nodes">
            {Array.from({ length: 24 }).map((_, i) => (
                <div
                    key={i}
                    className={`node-dot${activeIndices.includes(i) ? ' active' : ''}`}
                    style={{ animationDelay: `${i * 0.04}s` }}
                />
            ))}
        </div>
    );
};

// --- MAIN LANDING PAGE COMPONENT ---

interface LandingPageProps {
    onBeginAsDriver: () => void;
    onAdminAccess: () => void;
}

export default function LandingPage({ onBeginAsDriver, onAdminAccess }: LandingPageProps) {

    useEffect(() => {
        void initUnicornStudioBackground();

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });

        document.querySelectorAll('.lp-reveal, .lp-reveal-left, .lp-stagger-up').forEach(el => {
            revealObserver.observe(el);
        });

        const widgetObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                    widgetObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });

        document.querySelectorAll('.lp-bento-card').forEach(card => widgetObserver.observe(card));

        const lineObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('line-visible');
                    lineObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });

        const howSteps = document.querySelector('.lp-how-steps');
        if (howSteps) lineObserver.observe(howSteps);

        return () => {
            revealObserver.disconnect();
            widgetObserver.disconnect();
            lineObserver.disconnect();
        };
    }, []);

    return (
        <div className="lp-wrapper">
            <LandingCSS />

            {/* HERO */}
            <section className="lp-hero" id="hero">
                <div className="lp-hero-bg">
                    <div
                        data-us-project="WL20Cho3hr5Ge8Pk2QUl"
                        data-us-scale="0.75"
                        data-us-dpi="1"
                        data-us-fps="30"
                        data-us-lazyload="true"
                        data-us-production="true"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                    />
                </div>
                <div className="lp-hero-content">
                    <div className="lp-reveal">
                        <h1 className="lp-hero-brand">GRID</h1>
                        <h2 className="lp-hero-title" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)' }}>
                            The OS for <strong className="lp-text-gradient">Modern Mobility</strong>
                        </h2>
                        <div className="lp-hero-tags">
                            <span>Live Fleet</span>
                            <span>Demand AI</span>
                            <span>Safety</span>
                            <span>Real-time</span>
                        </div>
                    </div>
                    <div className="lp-hero-bottom lp-reveal">
                        <p className="lp-hero-desc">Command your fleet. Empower your drivers. Predict demand before it happens.</p>
                        <div className="lp-hero-actions">
                            <button className="lp-btn-primary" onClick={onBeginAsDriver}>Begin as a Driver</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* BENTO GRID */}
            <section className="lp-bento-section" id="features">
                <div className="lp-section-glow"></div>
                <div className="lp-container">
                    <div className="lp-bento-header lp-reveal">
                        <div className="lp-eyebrow">Intelligence</div>
                        <h2 className="lp-section-title">Built for the streets of NYC</h2>
                        <p className="lp-section-desc">A driver-first approach combining ML demand forecasting, real-time drowsiness detection, and hands-free voice navigation.</p>
                    </div>

                    <div className="lp-bento-grid lp-stagger-up">
                        <div className="lp-bento-card lp-w2 lp-reveal-child">
                            <h3>Where the Highest Demand Is</h3>
                            <p>Identify the busiest areas and best times to drive using XGBoost predictions. Simple 3-day forecasting without complex calendars.</p>
                            <div className="lp-widget-bars">
                                {[0.35, 0.55, 0.8, 0.45, 0.92, 0.65, 0.75, 0.5].map((h, i) => (
                                    <div key={i} className="lp-bar" style={{ '--h': h } as React.CSSProperties}></div>
                                ))}
                            </div>
                        </div>

                        <div className="lp-bento-card lp-w2 lp-reveal-child">
                            <h3>GRID Copilot</h3>
                            <p>Real-time MediaPipe face tracking to detect drowsiness, paired with Gemini AI hands-free voice dispatching.</p>
                            <div className="lp-widget-logs">
                                <div className="lp-log-line"><span className="lp-log-time">14:02:11</span><span className="lp-log-method lp-info">INFO</span><span className="lp-log-msg">Voice Cmd: "Navigate to Midtown"</span></div>
                                <div className="lp-log-line"><span className="lp-log-time">14:15:30</span><span className="lp-log-method lp-warn">WARN</span><span className="lp-log-msg">EAR threshold dip detected (0.21)</span></div>
                                <div className="lp-log-line"><span className="lp-log-time">14:16:05</span><span className="lp-log-method lp-alert">ALERT</span><span className="lp-log-msg">Drowsiness detected. Triggering alarm.</span></div>
                                <div className="lp-log-line"><span className="lp-log-time">14:16:10</span><span className="lp-log-method lp-info">INFO</span><span className="lp-log-msg">Driver engaged. Suggesting break zone.</span></div>
                                <div className="lp-log-line"><span className="lp-log-time">14:30:00</span><span className="lp-log-method lp-info">INFO</span><span className="lp-log-msg">Initiating resonance breathing exercise.</span></div>
                            </div>
                        </div>

                        <div className="lp-bento-card lp-reveal-child">
                            <h3>Driver Health</h3>
                            <p>Monitor your cumulative drive time and prevent burnout before it happens.</p>
                            <div className="lp-widget-status">
                                <div className="lp-status-row"><span className="lp-label">Drive Time</span><span className="lp-value lp-green">4h 12m</span></div>
                                <div className="lp-status-row"><span className="lp-label">Breaks Taken</span><span className="lp-value lp-yellow">1</span></div>
                                <div className="lp-status-row"><span className="lp-label">Fatigue Score</span><span className="lp-value lp-green">Low</span></div>
                                <div className="lp-status-row"><span className="lp-label">Next Break</span><span className="lp-value lp-yellow">In 45m</span></div>
                            </div>
                        </div>

                        <div className="lp-bento-card lp-reveal-child">
                            <h3>Shift Planner</h3>
                            <p>Input your targets. The AI calculates the optimal route to hit your goals.</p>
                            <div className="lp-widget-progress">
                                {[
                                    { label: 'Earnings Goal', val: '$180 / $250', w: '72%' },
                                    { label: 'Time Budget', val: '65%', w: '65%' },
                                    { label: 'Hotspot Match', val: '92%', w: '92%' },
                                ].map(({ label, val, w }) => (
                                    <div key={label} className="lp-progress-item">
                                        <div className="lp-progress-label"><span>{label}</span><span>{val}</span></div>
                                        <div className="lp-progress-track"><div className="lp-progress-fill" style={{ '--w': w } as React.CSSProperties}></div></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lp-bento-card lp-reveal-child">
                            <h3>Fleet Topology</h3>
                            <p>Live map of active drivers and predicted volume across all boroughs.</p>
                            <NodeGrid />
                        </div>

                        <div className="lp-bento-card lp-reveal-child">
                            <h3>Performance KPIs</h3>
                            <p>Track your shift earnings without the cognitive overload.</p>
                            <div className="lp-widget-metrics">
                                <div className="lp-mini-metric">
                                    <div className="lp-metric-value"><MetricCounter target={38} isMini /></div>
                                    <div className="lp-metric-label">Avg $/hr</div>
                                </div>
                                <div className="lp-mini-metric">
                                    <div className="lp-metric-value"><MetricCounter target={14} isMini /></div>
                                    <div className="lp-metric-label">Rides</div>
                                </div>
                                <div className="lp-mini-metric">
                                    <div className="lp-metric-value"><MetricCounter target={22} isMini /></div>
                                    <div className="lp-metric-label">Tip Avg %</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SHOWCASE */}
            <section className="lp-showcase-section" id="platform">
                <div className="lp-section-glow lp-right"></div>
                <div className="lp-container">
                    <div className="lp-showcase-grid">
                        <div className="lp-reveal">
                            <div className="lp-eyebrow">Two Views, One Platform</div>
                            <h2 className="lp-section-title">Fleet Operations<br />Intelligence</h2>
                            <p className="lp-section-desc">Get the 30,000-foot view to allocate resources intelligently. Data-driven fleet strategy replacing gut decisions.</p>
                            <div className="lp-showcase-features">
                                {[
                                    { icon: LayoutDashboard, title: 'Driver-First UI', desc: 'No jargon, just results. Simple recommendations for drivers sitting in traffic.' },
                                    { icon: BrainCircuit, title: 'Dynamic Shift Insights', desc: 'Learn from missed opportunities. Real-time feedback on skipped rides to optimize future earnings.' },
                                    { icon: BarChart3, title: 'Data Transparency', desc: 'Dive deep with advanced charts. Compare base, event-enriched, and improved XGBoost model variants.' },
                                ].map(({ icon: Icon, title, desc }) => (
                                    <div key={title} className="lp-showcase-feature">
                                        <div className="lp-showcase-feature-icon"><Icon size={18} /></div>
                                        <div><h4>{title}</h4><p>{desc}</p></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lp-dashboard-mock lp-reveal">
                            <div className="lp-dashboard-header">
                                <span className="lp-dashboard-dot lp-red"></span>
                                <span className="lp-dashboard-dot lp-yellow"></span>
                                <span className="lp-dashboard-dot lp-green"></span>
                                <span className="lp-dashboard-header-title">grid-admin — live-zones</span>
                            </div>
                            <div className="lp-dashboard-body">
                                <table className="lp-dashboard-table">
                                    <thead>
                                        <tr><th>NYC Zone</th><th>Demand Status</th><th>Expected Pickups</th><th>Trend</th></tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { zone: 'Midtown Center', badge: 'lp-running', status: 'Surging', pickups: '842 / hr', bars: [8,14,18,22,26] },
                                            { zone: 'JFK Airport', badge: 'lp-running', status: 'High Demand', pickups: '512 / hr', bars: [12,16,10,18,20] },
                                            { zone: 'Upper East Side', badge: 'lp-pending', status: 'Rising', pickups: '320 / hr', bars: [4,6,8,12,16] },
                                            { zone: 'Times Square', badge: 'lp-running', status: 'Surging', pickups: '950 / hr', bars: [18,16,20,24,28] },
                                            { zone: 'Williamsburg', badge: 'lp-stopped', status: 'Stable', pickups: '145 / hr', bars: [8,8,8,8,8] },
                                        ].map(({ zone, badge, status, pickups, bars }) => (
                                            <tr key={zone}>
                                                <td>{zone}</td>
                                                <td><span className={`lp-status-badge ${badge}`}>{status}</span></td>
                                                <td>{pickups}</td>
                                                <td>
                                                    <div className="lp-mini-bars">
                                                        {bars.map((h, i) => <div key={i} className="lp-mb" style={{ height: `${h}px` }}></div>)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="lp-how-section" id="pipeline">
                <div className="lp-container">
                    <div className="lp-how-header lp-reveal">
                        <div className="lp-eyebrow">The Architecture</div>
                        <h2 className="lp-section-title">The Intelligence Pipeline</h2>
                        <p className="lp-section-desc">How raw urban metrics transform into predictive action for drivers on the ground.</p>
                    </div>
                    <div className="lp-how-steps lp-stagger-up">
                        {[
                            { num: 1, icon: Database, title: 'Data Sources', desc: 'Ingesting NYC Taxi trip records, live MTA Transit data, weather APIs, and event schedules.' },
                            { num: 2, icon: Filter, title: 'Preprocessing', desc: 'Cleaning, engineering features, aligning time-series, and merging all data sources contextually.' },
                            { num: 3, icon: Cpu, title: 'ML Training', desc: 'Training advanced XGBoost models on the merged dataset using temporal signals and lagged demand.' },
                            { num: 4, icon: Target, title: 'Evaluation', desc: 'Measuring accuracy, precision, and recall using RMSE to generate confident zone predictions.' },
                            { num: 5, icon: RefreshCw, title: 'Feedback Loop', desc: 'Using evaluation results and live driver behavior to improve the model iteratively.' },
                        ].map(({ num, icon: Icon, title, desc }) => (
                            <div key={num} className="lp-how-step lp-reveal-child">
                                <div className="lp-step-node">
                                    <span className="lp-step-num">{num}</span>
                                    <Icon size={28} style={{ color: 'var(--lp-accent)' }} />
                                </div>
                                <h3>{title}</h3>
                                <p>{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* METRICS */}
            <section className="lp-metrics-section">
                <div className="lp-container">
                    <div className="lp-metrics-grid">
                        <div className="lp-metric-item lp-reveal">
                            <div className="lp-metric-number"><MetricCounter target={92.4} suffix="%" decimals={1} /></div>
                            <div className="lp-metric-label">Accuracy on Demand Curves</div>
                        </div>
                        <div className="lp-metric-item lp-reveal">
                            <div className="lp-metric-number"><MetricCounter target={5} prefix="<" suffix="ms" /></div>
                            <div className="lp-metric-label">Inference Latency</div>
                        </div>
                        <div className="lp-metric-item lp-reveal">
                            <div className="lp-metric-number"><MetricCounter target={250} suffix="K+" /></div>
                            <div className="lp-metric-label">NYC Trips Analyzed</div>
                        </div>
                        <div className="lp-metric-item lp-reveal">
                            <div className="lp-metric-number"><MetricCounter target={100} suffix="%" /></div>
                            <div className="lp-metric-label">Hands-free Navigation</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="lp-footer">
                <div className="lp-container">
                    <div className="lp-footer-grid">
                        <div className="lp-footer-brand">
                            <div className="lp-nav-logo">GRID</div>
                            <p>An intelligent platform combining demand forecasting, drowsiness detection, and voice navigation.</p>
                            <div className="lp-footer-social">
                                <a href="#" aria-label="GitHub"><Github size={18} /></a>
                                <a href="#" aria-label="Twitter"><Twitter size={18} /></a>
                                <a href="#" aria-label="LinkedIn"><Linkedin size={18} /></a>
                            </div>
                        </div>
                        <div className="lp-footer-col">
                            <h4>Product</h4>
                            <a href="#">Driver App</a>
                            <button type="button" className="lp-footer-admin-access" onClick={onAdminAccess}>
                                <Shield size={14} />
                                Access Admin Panel
                            </button>
                            <a href="#">GRID Copilot</a>
                        </div>
                        <div className="lp-footer-col">
                            <h4>Technology</h4>
                            <a href="#">XGBoost Model</a>
                            <a href="#">LightGBM</a>
                            <a href="#">Gemini API</a>
                        </div>
                        <div className="lp-footer-col">
                            <h4>Data Sets</h4>
                            <a href="#">NYC Taxi Data</a>
                            <a href="#">NYC Transit Data</a>
                            <a href="#">Weather API</a>
                            <a href="#">NYC Event Data</a>
                        </div>
                    </div>
                    <div className="lp-footer-bottom">
                        <span>© {new Date().getFullYear()} GRID Mobility. All rights reserved.</span>
                        <div className="lp-footer-bottom-links">
                            <a href="#">Privacy</a>
                            <a href="#">Terms</a>
                            <button type="button" className="lp-admin-link" onClick={onAdminAccess}>
                                <Shield size={12} />
                                Admin Panel
                            </button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// --- STYLES ---
const LandingCSS = () => (
    <style dangerouslySetInnerHTML={{
        __html: `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&family=Outfit:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --lp-bg: #050514;
      --lp-bg-alt: #0a0a1e;
      --lp-accent: #facc15;
      --lp-accent2: #fbbf24;
      --lp-accent3: #eab308;
      --lp-pink: #f59e0b;
      --lp-gold: #fde047;
      --lp-text: #e8edf3;
      --lp-text-muted: #94a3b8;
      --lp-text-dim: #4b5e78;
      --lp-border: rgba(250,204,21,0.15);
      --lp-font-heading: 'Outfit', sans-serif;
      --lp-font-body: 'Inter', sans-serif;
      --lp-font-mono: 'JetBrains Mono', monospace;
    }

    @property --lp-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
    @property --lp-shimmer-pos { syntax: '<percentage>'; initial-value: -100%; inherits: false; }

    .lp-wrapper {
      background-color: var(--lp-bg);
      color: var(--lp-text);
      font-family: var(--lp-font-body);
      font-size: 16px;
      line-height: 1.6;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }

    .lp-wrapper::before {
      content: '';
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 9999;
      pointer-events: none;
      opacity: 0.03;
      mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    .lp-wrapper a { color: inherit; text-decoration: none; }
    .lp-wrapper button { cursor: pointer; border: none; background: none; font-family: inherit; color: inherit; }
    .lp-container { max-width: 1600px; width: 100%; margin: 0 auto; padding: 0 48px; }
    .lp-wrapper h1,.lp-wrapper h2,.lp-wrapper h3,.lp-wrapper h4 { font-family: var(--lp-font-heading); font-weight: 200; letter-spacing: -0.03em; line-height: 1.15; }

    .lp-text-gradient {
      background: linear-gradient(135deg, var(--lp-accent) 0%, var(--lp-pink) 50%, var(--lp-gold) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 400;
    }

    .lp-eyebrow { font-family: var(--lp-font-mono); font-size: 0.72rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lp-accent2); margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    .lp-eyebrow::before { content: ''; width: 20px; height: 1px; background: var(--lp-accent2); }
    .lp-section-title { font-size: clamp(1.8rem, 3vw, 2.4rem); margin-bottom: 16px; color: var(--lp-text); }
    .lp-section-desc { font-size: 0.88rem; color: var(--lp-text-muted); max-width: 520px; font-weight: 300; line-height: 1.7; }

    @keyframes lp-spin { to { --lp-angle: 360deg; } }
    @keyframes lp-shimmer { to { --lp-shimmer-pos: 200%; } }
    @keyframes lp-glow-pulse { 0%,100% { opacity:0.85; filter:drop-shadow(0 0 12px rgba(250,204,21,0.3)); } 50% { opacity:1; filter:drop-shadow(0 0 20px rgba(250,204,21,0.5)); } }
    @keyframes lp-line-shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
    @keyframes lp-node-pulse { 0%,100% { opacity:0.7; } 50% { opacity:1; } }
    @keyframes lp-bar-grow { from { height:0; } to { height:calc(var(--h) * 80px); } }
    @keyframes lp-progress-fill { from { width:0; } to { width:var(--w); } }
    @keyframes lp-slideInRow { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
    @keyframes lp-fadeInLine { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes lp-popIn { from { opacity:0; transform:scale(0); } to { opacity:1; transform:scale(1); } }

.lp-reveal { opacity:0; transform:translateY(16px); transition:opacity 0.6s ease,transform 0.6s ease; }
    .lp-reveal.visible { opacity:1; transform:none; }
    .lp-reveal-left { opacity:0; transform:translateX(-16px); transition:opacity 0.6s ease,transform 0.6s ease; }
    .lp-reveal-left.visible { opacity:1; transform:none; }
    .lp-stagger-up .lp-reveal-child { opacity:0; transform:translateY(12px); transition:opacity 0.5s ease,transform 0.5s ease; }
    .lp-stagger-up.visible .lp-reveal-child { opacity:1; transform:none; }
    .lp-stagger-up.visible .lp-reveal-child:nth-child(1) { transition-delay:0ms; }
    .lp-stagger-up.visible .lp-reveal-child:nth-child(2) { transition-delay:80ms; }
    .lp-stagger-up.visible .lp-reveal-child:nth-child(3) { transition-delay:160ms; }
    .lp-stagger-up.visible .lp-reveal-child:nth-child(4) { transition-delay:240ms; }
    .lp-stagger-up.visible .lp-reveal-child:nth-child(5) { transition-delay:320ms; }
    .lp-stagger-up.visible .lp-reveal-child:nth-child(6) { transition-delay:400ms; }

    /* HERO */
    .lp-hero { position:relative; min-height:100vh; display:flex; flex-direction:column; overflow:hidden; }
    .lp-hero-bg { position:absolute; top:0; left:0; width:100%; height:100%; z-index:0; pointer-events:none; }
    .lp-hero-bg::after { content:''; position:absolute; bottom:0; left:0; width:100%; height:30%; background:linear-gradient(to bottom,transparent,var(--lp-bg)); z-index:1; }
    .lp-hero-content { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; max-width:800px; width:100%; margin:0 auto; padding:0 24px; text-align:center; }
    .lp-hero-brand { font-size:clamp(4rem,12vw,7rem); font-weight:600; line-height:1; margin-bottom:0; letter-spacing:-0.01em; text-transform:uppercase; background:linear-gradient(170deg,#ffffff 40%,var(--lp-accent2) 110%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; display:inline-block; filter:drop-shadow(0 4px 20px rgba(250,204,21,0.15)); }
    .lp-hero-tags { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:10px; margin-top:24px; }
    .lp-hero-tags span { padding:4px 12px; border-radius:100px; border:1px solid var(--lp-border); background:rgba(250,204,21,0.06); font-size:0.6rem; font-weight:500; color:var(--lp-accent2); letter-spacing:0.05em; text-transform:uppercase; font-family:var(--lp-font-mono); }
    .lp-hero-title { font-weight:300; line-height:1.1; letter-spacing:-0.04em; }
    .lp-hero-bottom { display:flex; flex-direction:column; align-items:center; gap:20px; margin-top:24px; }
    .lp-hero-desc { font-size:1.05rem; color:var(--lp-text-muted); max-width:500px; font-weight:300; line-height:1.7; }
    .lp-hero-actions { display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-top:10px; }
        .lp-btn-primary {
            position:relative;
            padding:14px 36px;
            border-radius:100px;
            font-size:0.95rem;
            font-weight:600;
            letter-spacing:0.01em;
            color:#0b1220;
            background:linear-gradient(135deg,var(--lp-accent) 0%,var(--lp-accent2) 55%,var(--lp-gold) 100%);
            border:1px solid rgba(250,204,21,0.85);
            box-shadow:0 10px 28px rgba(250,204,21,0.28), inset 0 1px 0 rgba(255,255,255,0.35);
            z-index:1;
            transition:transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
        }
        .lp-btn-primary:hover {
            transform:translateY(-2px);
            box-shadow:0 14px 34px rgba(250,204,21,0.34), inset 0 1px 0 rgba(255,255,255,0.45);
            filter:saturate(1.05);
        }
        .lp-btn-primary:focus-visible {
            outline:2px solid rgba(250,204,21,0.95);
            outline-offset:3px;
        }

    /* BENTO */
    .lp-bento-section { padding:120px 0; position:relative; }
    .lp-bento-section::before { content:''; position:absolute; top:0; left:0; width:100%; height:100%; background-image:radial-gradient(rgba(250,204,21,0.12) 1px,transparent 1px); background-size:24px 24px; mask-image:radial-gradient(ellipse 60% 50% at 50% 50%,black,transparent); -webkit-mask-image:radial-gradient(ellipse 60% 50% at 50% 50%,black,transparent); pointer-events:none; }
    .lp-section-glow { position:absolute; top:20%; left:50%; transform:translateX(-50%); width:600px; height:400px; background:radial-gradient(ellipse,rgba(250,204,21,0.08),transparent 70%); pointer-events:none; }
    .lp-section-glow.lp-right { top:30%; right:0; left:auto; transform:none; width:500px; height:500px; background:radial-gradient(ellipse,rgba(250,204,21,0.06),transparent 70%); }
    .lp-bento-header { text-align:center; margin-bottom:60px; }
    .lp-bento-header .lp-section-desc { margin:0 auto; }
    .lp-bento-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
    .lp-bento-card.lp-w2 { grid-column:span 2; }
    .lp-bento-card { position:relative; padding:28px; border-radius:16px; background:rgba(255,255,255,0.03); border:1px solid var(--lp-border); overflow:hidden; transition:transform 0.35s ease,border-color 0.35s ease,background 0.35s ease,box-shadow 0.35s ease; }
    .lp-bento-card::before { content:''; position:absolute; top:0; left:20%; right:20%; height:1px; background:linear-gradient(90deg,transparent,var(--lp-accent2),var(--lp-accent),var(--lp-accent2),transparent); opacity:0; transition:opacity 0.4s ease; pointer-events:none; }
    .lp-bento-card:hover { transform:translateY(-3px); border-color:rgba(250,204,21,0.15); background:rgba(255,255,255,0.045); box-shadow:0 8px 32px rgba(250,204,21,0.06); }
    .lp-bento-card:hover::before { opacity:1; left:10%; right:10%; }
    .lp-bento-card h3 { font-size:1rem; font-weight:500; margin-bottom:8px; letter-spacing:-0.02em; }
    .lp-bento-card p { font-size:0.78rem; color:var(--lp-text-muted); font-weight:300; line-height:1.6; margin-bottom:20px; }

    /* WIDGETS */
    .lp-widget-bars { display:flex; align-items:flex-end; gap:6px; height:80px; padding-top:8px; }
    .lp-bar { flex:1; border-radius:3px 3px 0 0; background:linear-gradient(to top,var(--lp-accent),var(--lp-pink)); height:calc(var(--h) * 80px); min-height:4px; }
    .lp-bento-card.animated .lp-bar { animation:lp-bar-grow 0.8s cubic-bezier(0.34,1.56,0.64,1) both; }
    .lp-bento-card.animated .lp-bar:nth-child(1){animation-delay:0.1s}
    .lp-bento-card.animated .lp-bar:nth-child(2){animation-delay:0.2s}
    .lp-bento-card.animated .lp-bar:nth-child(3){animation-delay:0.3s}
    .lp-bento-card.animated .lp-bar:nth-child(4){animation-delay:0.4s}
    .lp-bento-card.animated .lp-bar:nth-child(5){animation-delay:0.5s}
    .lp-bento-card.animated .lp-bar:nth-child(6){animation-delay:0.6s}
    .lp-bento-card.animated .lp-bar:nth-child(7){animation-delay:0.7s}
    .lp-bento-card.animated .lp-bar:nth-child(8){animation-delay:0.8s}

    .lp-widget-status { display:flex; flex-direction:column; gap:6px; }
    .lp-status-row { display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-radius:6px; background:rgba(255,255,255,0.02); font-size:0.72rem; font-family:var(--lp-font-mono); }
    .lp-bento-card.animated .lp-status-row { animation:lp-slideInRow 0.5s cubic-bezier(0.16,1,0.3,1) both; }
    .lp-bento-card.animated .lp-status-row:nth-child(1){animation-delay:0.15s}
    .lp-bento-card.animated .lp-status-row:nth-child(2){animation-delay:0.25s}
    .lp-bento-card.animated .lp-status-row:nth-child(3){animation-delay:0.35s}
    .lp-bento-card.animated .lp-status-row:nth-child(4){animation-delay:0.45s}
    .lp-label { color:var(--lp-text-muted); }
    .lp-value { font-weight:500; }
    .lp-value.lp-green { color:#34d399; }
    .lp-value.lp-yellow { color:var(--lp-gold); }

    .lp-widget-progress { display:flex; flex-direction:column; gap:12px; }
    .lp-progress-item { display:flex; flex-direction:column; gap:4px; }
    .lp-progress-label { display:flex; justify-content:space-between; font-size:0.68rem; color:var(--lp-text-muted); font-family:var(--lp-font-mono); }
    .lp-progress-track { width:100%; height:4px; border-radius:2px; background:rgba(255,255,255,0.05); overflow:hidden; }
    .lp-progress-fill { height:100%; border-radius:2px; background:linear-gradient(90deg,var(--lp-accent),var(--lp-pink)); width:0; }
    .lp-bento-card.animated .lp-progress-fill { animation:lp-progress-fill 1.2s cubic-bezier(0.16,1,0.3,1) forwards; }
    .lp-bento-card.animated .lp-progress-item:nth-child(1) .lp-progress-fill{animation-delay:0.2s}
    .lp-bento-card.animated .lp-progress-item:nth-child(2) .lp-progress-fill{animation-delay:0.35s}
    .lp-bento-card.animated .lp-progress-item:nth-child(3) .lp-progress-fill{animation-delay:0.5s}

    .lp-widget-logs { display:flex; flex-direction:column; gap:4px; }
    .lp-log-line { display:flex; align-items:center; gap:8px; padding:4px 8px; border-radius:4px; background:rgba(0,0,0,0.3); font-family:var(--lp-font-mono); font-size:0.64rem; }
    .lp-bento-card.animated .lp-log-line { animation:lp-fadeInLine 0.4s ease both; }
    .lp-bento-card.animated .lp-log-line:nth-child(1){animation-delay:0.2s}
    .lp-bento-card.animated .lp-log-line:nth-child(2){animation-delay:0.35s}
    .lp-bento-card.animated .lp-log-line:nth-child(3){animation-delay:0.5s}
    .lp-bento-card.animated .lp-log-line:nth-child(4){animation-delay:0.65s}
    .lp-bento-card.animated .lp-log-line:nth-child(5){animation-delay:0.8s}
    .lp-log-time { color:var(--lp-text-dim); }
    .lp-log-method { padding:1px 6px; border-radius:3px; font-size:0.6rem; font-weight:500; text-transform:uppercase; }
    .lp-info { background:rgba(52,211,153,0.15); color:#34d399; }
    .lp-alert { background:rgba(244,114,182,0.15); color:#f43f5e; }
    .lp-warn { background:rgba(250,204,21,0.15); color:var(--lp-accent2); }
    .lp-log-msg { color:var(--lp-text-muted); }

    .widget-nodes { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; }
    .node-dot { width:100%; aspect-ratio:1; border-radius:50%; background:rgba(255,255,255,0.06); }
    .node-dot.active { background:var(--lp-accent); animation:lp-node-pulse 2s ease-in-out infinite; }
    .lp-bento-card.animated .node-dot { animation:lp-popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
    .lp-bento-card.animated .node-dot.active { animation:lp-popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both,lp-node-pulse 2s ease-in-out infinite 0.5s; }

    .lp-widget-metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .lp-mini-metric { padding:12px 10px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(250,204,21,0.08); text-align:center; }
    .lp-metric-value { font-family:var(--lp-font-heading); font-size:1.2rem; font-weight:300; color:var(--lp-text); letter-spacing:-0.02em; }
    .lp-metric-label { font-size:0.62rem; color:var(--lp-text-dim); margin-top:2px; font-family:var(--lp-font-mono); text-transform:uppercase; letter-spacing:0.05em; }

    /* SHOWCASE */
    .lp-showcase-section { padding:120px 0; position:relative; overflow:hidden; }
    .lp-showcase-grid { display:grid; grid-template-columns:1fr 1.2fr; gap:60px; align-items:center; }
    .lp-showcase-features { display:flex; flex-direction:column; gap:28px; margin-top:32px; }
    .lp-showcase-feature { display:flex; gap:16px; align-items:flex-start; }
    .lp-showcase-feature-icon { width:36px; height:36px; border-radius:8px; background:rgba(250,204,21,0.1); display:flex; align-items:center; justify-content:center; color:var(--lp-accent2); flex-shrink:0; }
    .lp-showcase-feature h4 { font-size:0.88rem; font-weight:500; margin-bottom:4px; }
    .lp-showcase-feature p { font-size:0.76rem; color:var(--lp-text-muted); font-weight:300; line-height:1.6; }

    .lp-dashboard-mock { border-radius:16px; border:1px solid var(--lp-border); background:rgba(255,255,255,0.02); overflow:hidden; position:relative; }
    .lp-dashboard-mock::before { content:''; position:absolute; inset:-1px; border-radius:17px; background:linear-gradient(135deg,rgba(250,204,21,0.15),transparent 50%,rgba(250,204,21,0.05)); z-index:-1; }
    .lp-dashboard-header { display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--lp-border); background:rgba(0,0,0,0.2); }
    .lp-dashboard-dot { width:8px; height:8px; border-radius:50%; }
    .lp-dashboard-dot.lp-red { background:#f87171; }
    .lp-dashboard-dot.lp-yellow { background:#fbbf24; }
    .lp-dashboard-dot.lp-green { background:#34d399; }
    .lp-dashboard-header-title { font-size:0.68rem; color:var(--lp-text-dim); font-family:var(--lp-font-mono); margin-left:8px; }
    .lp-dashboard-body { padding:20px; }
    .lp-dashboard-table { width:100%; font-size:0.72rem; }
    .lp-dashboard-table th { text-align:left; padding:8px 12px; color:var(--lp-text-dim); font-weight:500; font-family:var(--lp-font-mono); text-transform:uppercase; font-size:0.62rem; letter-spacing:0.08em; border-bottom:1px solid var(--lp-border); }
    .lp-dashboard-table td { padding:10px 12px; color:var(--lp-text-muted); border-bottom:1px solid rgba(250,204,21,0.05); font-family:var(--lp-font-mono); }
    .lp-dashboard-table tr:last-child td { border-bottom:none; }
    .lp-status-badge { display:inline-block; padding:2px 8px; border-radius:100px; font-size:0.62rem; font-weight:500; }
    .lp-status-badge.lp-running { background:rgba(52,211,153,0.1); color:#34d399; }
    .lp-status-badge.lp-pending { background:rgba(250,204,21,0.1); color:var(--lp-gold); }
    .lp-status-badge.lp-stopped { background:rgba(244,114,182,0.1); color:#f43f5e; }
    .lp-mini-bars { display:flex; align-items:flex-end; gap:2px; height:20px; }
    .lp-mb { width:4px; border-radius:1px; background:var(--lp-accent); opacity:0.6; }

    /* HOW IT WORKS */
    .lp-how-section { padding:120px 0; position:relative; background:var(--lp-bg-alt); }
    .lp-how-section::before { content:''; position:absolute; top:0; left:0; width:100%; height:1px; background:linear-gradient(90deg,transparent,var(--lp-border),transparent); }
    .lp-how-header { text-align:center; margin-bottom:80px; }
    .lp-how-header .lp-section-desc { margin:0 auto; }
    .lp-how-steps { display:grid; grid-template-columns:repeat(5,1fr); gap:0; position:relative; }
    .lp-how-steps::before { content:''; position:absolute; top:40px; left:calc(10% + 20px); right:calc(10% + 20px); height:2px; background:linear-gradient(90deg,var(--lp-accent),var(--lp-pink),var(--lp-accent3)); background-size:200% 100%; animation:lp-line-shimmer 3s linear infinite; transform:scaleX(0); transform-origin:left; transition:transform 1.2s cubic-bezier(0.16,1,0.3,1); }
    .lp-how-steps.line-visible::before { transform:scaleX(1); }
    .lp-how-step { display:flex; flex-direction:column; align-items:center; text-align:center; padding:0 12px; position:relative; }
    .lp-step-node { width:80px; height:80px; border-radius:50%; background:var(--lp-bg-alt); border:2px solid var(--lp-accent); display:flex; align-items:center; justify-content:center; margin-bottom:24px; position:relative; z-index:1; animation:lp-glow-pulse 3s ease-in-out infinite; }
    .lp-step-num { position:absolute; top:-6px; right:-6px; width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg,var(--lp-accent),var(--lp-accent3)); display:flex; align-items:center; justify-content:center; font-size:0.62rem; font-weight:600; color:#000; }
    .lp-how-step h3 { font-size:1rem; font-weight:500; margin-bottom:8px; }
    .lp-how-step p { font-size:0.74rem; color:var(--lp-text-muted); font-weight:300; line-height:1.6; }

    /* METRICS */
    .lp-metrics-section { padding:20px 0; border-top:1px solid var(--lp-border); border-bottom:1px solid var(--lp-border); }
    .lp-metrics-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:40px; }
    .lp-metric-item { text-align:center; }
    .lp-metric-number { font-family:var(--lp-font-heading); font-size:clamp(2rem,3.5vw,2.8rem); font-weight:200; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--lp-text) 0%,var(--lp-accent2) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
    .lp-metric-label { font-size:0.76rem; color:var(--lp-text-muted); margin-top:4px; font-weight:300; }

    /* FOOTER */
    .lp-footer { padding:40px 0 24px; border-top:1px solid var(--lp-border); }
    .lp-footer-grid { display:grid; grid-template-columns:1.5fr repeat(3,1fr); gap:40px; margin-bottom:32px; }
    .lp-footer-brand .lp-nav-logo { margin-bottom:16px; font-family:var(--lp-font-heading); font-weight:600; font-size:1.2rem; letter-spacing:0.1em; color:var(--lp-text); }
    .lp-footer-brand p { font-size:0.78rem; color:var(--lp-text-muted); font-weight:300; line-height:1.7; max-width:260px; margin-bottom:16px; }
    .lp-footer-social { display:flex; gap:12px; }
    .lp-footer-social a { width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.04); border:1px solid var(--lp-border); display:flex; align-items:center; justify-content:center; color:var(--lp-text-dim); transition:all 0.2s; }
    .lp-footer-social a:hover { color:var(--lp-text); border-color:rgba(250,204,21,0.2); background:rgba(250,204,21,0.06); }
    .lp-footer-col h4 { font-size:0.76rem; font-weight:600; margin-bottom:16px; letter-spacing:0.03em; text-transform:uppercase; color:var(--lp-text); }
    .lp-footer-col a { display:block; font-size:0.78rem; color:var(--lp-text-muted); font-weight:300; padding:4px 0; transition:color 0.2s; }
    .lp-footer-col a:hover { color:var(--lp-text); }
    .lp-footer-admin-access { display:inline-flex; align-items:center; gap:8px; font-size:0.78rem; color:var(--lp-accent2); font-weight:500; margin:6px 0; padding:6px 10px; border-radius:8px; border:1px solid rgba(250,204,21,0.25); background:rgba(250,204,21,0.08); transition:all 0.2s; }
    .lp-footer-admin-access:hover { color:var(--lp-text); border-color:rgba(250,204,21,0.45); background:rgba(250,204,21,0.16); }
    .lp-footer-admin-access:focus-visible { outline:2px solid rgba(250,204,21,0.75); outline-offset:2px; }
    .lp-footer-bottom { display:flex; justify-content:space-between; align-items:center; padding-top:24px; border-top:1px solid var(--lp-border); font-size:0.72rem; color:var(--lp-text-dim); font-weight:300; }
    .lp-footer-bottom-links { display:flex; align-items:center; gap:24px; }
    .lp-footer-bottom-links a:hover { color:var(--lp-text-muted); }
    .lp-admin-link { display:inline-flex; align-items:center; gap:6px; font-size:0.72rem; color:var(--lp-text-dim); font-weight:400; background:none; border:1px solid rgba(250,204,21,0.1); border-radius:6px; padding:4px 10px; transition:all 0.2s; cursor:pointer; }
    .lp-admin-link:hover { color:var(--lp-accent2); border-color:rgba(250,204,21,0.3); background:rgba(250,204,21,0.05); }
    .lp-admin-link:focus-visible { outline:2px solid rgba(250,204,21,0.75); outline-offset:2px; }

    /* RESPONSIVE */
    @media (max-width:1024px) {
      .lp-bento-grid { grid-template-columns:repeat(2,1fr); }
      .lp-bento-card.lp-w2 { grid-column:span 1; }
      .lp-showcase-grid { grid-template-columns:1fr; gap:40px; }
      .lp-footer-grid { grid-template-columns:1.2fr repeat(3,1fr); gap:28px; }
      .lp-how-steps { grid-template-columns:repeat(3,1fr); gap:40px; }
      .lp-how-steps::before { display:none; }
    }
    @media (max-width:768px) {
      .lp-bento-section,.lp-showcase-section,.lp-how-section { padding:80px 0; }
      .lp-bento-grid { grid-template-columns:1fr; }
      .lp-bento-card.lp-w2 { grid-column:span 1; }
      .lp-metrics-grid { grid-template-columns:repeat(2,1fr); gap:24px; }
      .lp-footer-grid { grid-template-columns:1fr 1fr; gap:32px; }
      .lp-how-steps { grid-template-columns:1fr; gap:48px; }
    }
    @media (max-width:480px) {
      .lp-container { padding:0 16px; }
      .lp-hero-actions .lp-btn-primary { width:100%; text-align:center; }
      .lp-footer-grid { grid-template-columns:1fr; gap:24px; }
      .lp-footer-bottom { flex-direction:column; gap:12px; text-align:center; }
      .lp-metrics-grid { grid-template-columns:1fr 1fr; gap:16px; }
    }
  `}} />
);
