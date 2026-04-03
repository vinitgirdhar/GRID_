import { useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import type {
  Driver,
  DrowsinessResponse,
  RetrainEvent,
} from '../types';

export type LiveStreamEvent =
  | { type: 'connected' }
  | { type: 'drivers'; data: Driver[] }
  | { type: 'drowsiness'; data: DrowsinessResponse }
  | { type: 'session'; data: { is_live: boolean } }
  | { type: 'retrain'; data: RetrainEvent }
  | { type: 'prediction'; data: { zone_id: string; level: string; predicted_demand: number; ts: string } };

export type LiveStreamHandlers = {
  onDrivers?: (drivers: Driver[]) => void;
  onDrowsiness?: (state: DrowsinessResponse) => void;
  onSession?: (state: { is_live: boolean }) => void;
  onRetrain?: (event: RetrainEvent) => void;
  onPrediction?: (event: { zone_id: string; level: string; predicted_demand: number; ts: string }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

export function useLiveStream(handlers: LiveStreamHandlers) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_DELAY_MS);
  const mountedRef = useRef(true);
  // Keep handlers in a ref so reconnects always use the latest callbacks
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    // Don't connect if backend is clearly not reachable (mock mode on localhost)
    const streamUrl = `${API_BASE_URL}/stream`;

    const es = new EventSource(streamUrl);
    esRef.current = es;

    es.addEventListener('connected', () => {
      reconnectDelay.current = RECONNECT_DELAY_MS;
      handlersRef.current.onConnected?.();
    });

    es.addEventListener('drivers', (e: MessageEvent) => {
      try {
        const drivers = JSON.parse(e.data) as Driver[];
        handlersRef.current.onDrivers?.(drivers);
      } catch { /* ignore malformed */ }
    });

    es.addEventListener('drowsiness', (e: MessageEvent) => {
      try {
        const state = JSON.parse(e.data) as DrowsinessResponse;
        handlersRef.current.onDrowsiness?.(state);
      } catch { /* ignore malformed */ }
    });

    es.addEventListener('session', (e: MessageEvent) => {
      try {
        const state = JSON.parse(e.data) as { is_live: boolean };
        handlersRef.current.onSession?.(state);
      } catch { /* ignore malformed */ }
    });

    es.addEventListener('retrain', (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as RetrainEvent;
        handlersRef.current.onRetrain?.(event);
      } catch { /* ignore malformed */ }
    });

    es.addEventListener('prediction', (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as { zone_id: string; level: string; predicted_demand: number; ts: string };
        handlersRef.current.onPrediction?.(event);
      } catch { /* ignore malformed */ }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      handlersRef.current.onDisconnected?.();
      if (!mountedRef.current) return;
      // Exponential backoff reconnect
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, MAX_RECONNECT_DELAY_MS);
        connect();
      }, reconnectDelay.current);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
