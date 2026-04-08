import { useEffect, useState } from 'react';
import { AlertTriangle, CameraOff, Eye } from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '../lib/utils';
import { getDrowsinessStatus } from '../services/apiService';
import { DrowsinessResponse, DrowsinessSeverity } from '../types';


const REFRESH_INTERVAL_MS = 15000;


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
      icon: 'bg-sky-500/15 text-sky-400',
      text: 'text-sky-400',
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
      className={cn('rounded-xl border px-2.5 py-2 shadow-sm', visual.panel)}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', visual.icon)}>
            <Icon size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Drowsiness</p>
            <p className="text-[13px] font-bold leading-tight text-[var(--text-primary)] truncate">{truncate(activeStatus.status, 18)}</p>
          </div>
        </div>
        <span className={cn('px-1.5 py-0.5 rounded-full text-[7px] font-black tracking-[0.18em] shrink-0', visual.badge)}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2">
        <div className="rounded-lg bg-white/5 border border-[rgba(250,204,21,0.1)] px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">EAR</p>
          <p className="text-[13px] font-bold text-[var(--text-primary)] leading-tight">
            {typeof activeStatus.ear === 'number' ? activeStatus.ear.toFixed(3) : '--'}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 border border-[rgba(250,204,21,0.1)] px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Closed</p>
          <p className="text-[13px] font-bold text-[var(--text-primary)] leading-tight">{activeStatus.eyes_closed_seconds.toFixed(1)}s</p>
        </div>
      </div>
    </motion.div>
  );
}
