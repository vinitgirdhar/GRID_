import { useEffect, useState } from 'react';
import { AlertTriangle, CameraOff, Eye } from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '../lib/utils';
import { getDrowsinessStatus } from '../services/apiService';
import { DrowsinessResponse, DrowsinessSeverity } from '../types';


const REFRESH_INTERVAL_MS = 2000;


function truncate(text: string | null | undefined, maxLength = 110): string | null {
  if (!text) {
    return null;
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}


function severityClasses(severity: DrowsinessSeverity) {
  if (severity === 'critical') {
    return {
      panel: 'bg-[var(--danger)]/10 border-[var(--danger)]/20',
      badge: 'bg-[var(--danger)] text-white',
      icon: 'bg-[var(--danger)]/15 text-[var(--danger)]',
      text: 'text-[var(--danger)]',
    };
  }

  if (severity === 'warning') {
    return {
      panel: 'bg-sky-500/10 border-sky-500/20',
      badge: 'bg-sky-500 text-white',
      icon: 'bg-sky-500/15 text-sky-600',
      text: 'text-sky-700',
    };
  }

  return {
    panel: 'bg-[var(--success)]/10 border-[var(--success)]/20',
    badge: 'bg-[var(--success)] text-white',
    icon: 'bg-[var(--success)]/15 text-[var(--success)]',
    text: 'text-[var(--success)]',
  };
}


function monitorIcon(status: DrowsinessResponse | null, error: string | null) {
  if (error || status?.status.toLowerCase().includes('face')) {
    return CameraOff;
  }
  if (status?.severity === 'critical') {
    return AlertTriangle;
  }
  return Eye;
}


export default function DrowsinessMonitor({
  isLive,
  collapsed = false,
}: {
  isLive: boolean;
  collapsed?: boolean;
}) {
  const [status, setStatus] = useState<DrowsinessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    let cancelled = false;

    const loadStatus = async () => {
      try {
        const nextStatus = await getDrowsinessStatus();
        if (!cancelled) {
          setStatus(nextStatus);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
          setError('Detector offline');
        }
      }
    };

    loadStatus();
    const intervalId = window.setInterval(loadStatus, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isLive]);

  const fallbackStatus: DrowsinessResponse = {
    status: error ?? 'Awaiting detector',
    severity: 'warning',
    ear: null,
    threshold: null,
    consecutive_closed_frames: 0,
    eyes_closed_seconds: 0,
    alarm_active: false,
    assistant_response: null,
    source: 'backend',
    updated_at: new Date().toISOString(),
  };

  const activeStatus = error ? fallbackStatus : (status ?? fallbackStatus);
  const visual = severityClasses(activeStatus.severity);
  const Icon = monitorIcon(status, error);
  const statusLabel = activeStatus.alarm_active ? 'ALERT' : activeStatus.severity.toUpperCase();
  const message = truncate(activeStatus.assistant_response, 96);

  if (collapsed) {
    return (
      <div
        className={cn(
          'w-10 h-10 mx-auto rounded-full border flex items-center justify-center',
          visual.panel,
        )}
        title={`Drowsiness: ${activeStatus.status}`}
      >
        <Icon size={16} className={visual.text} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-2xl border p-3 shadow-sm', visual.panel)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', visual.icon)}>
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Drowsiness</p>
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{activeStatus.status}</p>
          </div>
        </div>
        <span className={cn('px-2 py-1 rounded-full text-[9px] font-black tracking-widest shrink-0', visual.badge)}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-xl bg-white/60 border border-white/50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">EAR</p>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {typeof activeStatus.ear === 'number' ? activeStatus.ear.toFixed(3) : '--'}
          </p>
        </div>
        <div className="rounded-xl bg-white/60 border border-white/50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Closed</p>
          <p className="text-sm font-bold text-[var(--text-primary)]">{activeStatus.eyes_closed_seconds.toFixed(1)}s</p>
        </div>
      </div>

      {message && (
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {message}
        </p>
      )}
    </motion.div>
  );
}
