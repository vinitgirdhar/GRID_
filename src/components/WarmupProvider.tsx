/**
 * WarmupProvider — kicks off API pre-fetching in the background while
 * rendering children immediately. No splash screen — the app paints
 * instantly and dashboard pages pick up cached data when they mount.
 */
import React, { useEffect } from 'react';
import { runWarmup } from '../services/warmup';
import { startMediaPipePreload } from '../services/mediapipePreloader';

interface WarmupProviderProps {
  children: React.ReactNode;
}

export function WarmupProvider({ children }: WarmupProviderProps) {
  useEffect(() => {
    // Fire-and-forget: seeds the shared useApiData cache in the background.
    // Errors are handled internally by warmup.ts — the app always boots.
    runWarmup();

    // Pre-load the ~14 MB MediaPipe WASM + face model in the background
    // so the drowsiness camera boots instantly when the user opens it.
    startMediaPipePreload();
  }, []);

  return <>{children}</>;
}
