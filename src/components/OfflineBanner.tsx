import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw, WifiOff } from 'lucide-react';

import { cn } from '../lib/utils';

interface OfflineBannerProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  topClassName?: string;
}

export default function OfflineBanner({
  isOnline,
  isSyncing,
  pendingCount,
  topClassName,
}: OfflineBannerProps) {
  const isVisible = !isOnline || isSyncing;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className={cn(
            'fixed left-1/2 z-[70] flex w-[min(92vw,620px)] -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur',
            !isOnline
              ? 'border-amber-300/60 bg-amber-50/95 text-amber-950'
              : 'border-sky-300/60 bg-sky-50/95 text-sky-950',
            topClassName ?? 'top-4',
          )}
        >
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              !isOnline ? 'bg-amber-200/70 text-amber-700' : 'bg-sky-200/70 text-sky-700',
            )}
          >
            {!isOnline ? <WifiOff size={18} /> : <RefreshCw size={18} className="animate-spin" />}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.18em]">
              {!isOnline ? 'Offline Mode' : 'Syncing Saved Updates'}
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed">
              {!isOnline
                ? pendingCount > 0
                  ? `${pendingCount} saved update${pendingCount === 1 ? '' : 's'} queued. Cached hotspot data remains available.`
                  : 'Using cached driver data where available. New updates will sync automatically when the connection returns.'
                : pendingCount > 0
                  ? `Uploading ${pendingCount} queued update${pendingCount === 1 ? '' : 's'} now.`
                  : 'Connection restored. Finalizing offline updates.'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
