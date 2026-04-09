/**
 * WarmupProvider — wraps the entire app and pre-fetches all critical API data
 * before rendering any page content.
 *
 * Shows a premium animated splash screen while warming up. Once all data is
 * seeded into the shared cache, the app renders with instant page loads.
 */
import React, { useEffect, useRef, useState } from 'react';
import { runWarmup, WarmupProgress } from '../services/warmup';

interface WarmupProviderProps {
  children: React.ReactNode;
}

const MINIMUM_SPLASH_MS = 1400; // Always show splash for at least this long for UX polish

export function WarmupProvider({ children }: WarmupProviderProps) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<WarmupProgress>({
    done: 0,
    total: 5,
    label: 'Initialising GRID…',
    status: 'running',
  });
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const start = startRef.current;

    runWarmup((p) => setProgress(p)).then(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MINIMUM_SPLASH_MS - elapsed);

      setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => setReady(true), 400);
      }, remaining);
    });
  }, []);

  if (ready) return <>{children}</>;

  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(250,204,21,0.08) 0%, #050514 55%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2.5rem',
        fontFamily: 'Outfit, Inter, sans-serif',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease',
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(250,204,21,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(250,204,21,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Animated glow orb */}
      <div style={{
        position: 'absolute',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(250,204,21,0.06) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'pulse-glow 3s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Logo + brand */}
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '16px', marginBottom: '12px'
        }}>
          <img
            src="/grid-logo.png"
            alt="GRID"
            style={{ height: '56px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 24px rgba(250,204,21,0.35))' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span style={{
            fontSize: 'clamp(2rem, 6vw, 3.5rem)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            background: 'linear-gradient(155deg, #ffffff 35%, #fbbf24 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 4px 24px rgba(250,204,21,0.25))',
          }}>
            GRID
          </span>
        </div>
        <p style={{
          fontSize: '11px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.7)',
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          Mobility Intelligence Platform
        </p>
      </div>

      {/* Progress section */}
      <div style={{ width: 'min(360px, 80vw)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Bar container */}
        <div style={{
          height: '3px',
          background: 'rgba(250,204,21,0.1)',
          borderRadius: '99px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Animated fill */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0,
            width: `${pct}%`,
            background: 'linear-gradient(90deg, rgba(250,204,21,0.6), #facc15)',
            borderRadius: '99px',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 12px rgba(250,204,21,0.5)',
          }} />
          {/* Shimmer */}
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0,
            width: '80px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            left: `calc(${pct}% - 40px)`,
            transition: 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        {/* Status row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <p style={{
            fontSize: '12px',
            color: progress.status === 'complete' ? '#4ade80' : 'rgba(148,163,184,0.8)',
            fontFamily: '"JetBrains Mono", monospace',
            transition: 'color 0.3s',
          }}>
            {progress.status === 'complete' ? '✓ All systems ready' : progress.label}
          </p>
          <span style={{
            fontSize: '11px',
            color: 'rgba(250,204,21,0.6)',
            fontFamily: '"JetBrains Mono", monospace',
            minWidth: '36px',
            textAlign: 'right',
          }}>
            {pct}%
          </span>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
          {Array.from({ length: progress.total }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: i < progress.done ? '#facc15' : 'rgba(250,204,21,0.15)',
                transition: 'background 0.3s',
                boxShadow: i < progress.done ? '0 0 6px rgba(250,204,21,0.5)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Tagline */}
      <p style={{
        position: 'absolute',
        bottom: '32px',
        fontSize: '11px',
        color: 'rgba(148,163,184,0.35)',
        letterSpacing: '0.15em',
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        © {new Date().getFullYear()} GRID Mobility
      </p>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
