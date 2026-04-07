import { useEffect, useRef } from 'react';
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

// ── Singleton SSE Manager ────────────────────────────────────────────────────
// Only ONE EventSource is ever open, shared across all hook instances.

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60000;

type Subscriber = (event: LiveStreamEvent) => void;

let _es: EventSource | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnectDelay = RECONNECT_DELAY_MS;
const _subscribers = new Set<Subscriber>();

function _dispatch(event: LiveStreamEvent) {
  _subscribers.forEach((sub) => {
    try { sub(event); } catch { /* subscriber errors must not crash the manager */ }
  });
}

function _destroyStream() {
  if (_reconnectTimer !== null) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
  _es?.close();
  _es = null;
}

function _createStream() {
  if (_es && _es.readyState !== EventSource.CLOSED) return; // already open / connecting
  _destroyStream();

  const url = `${API_BASE_URL}/stream`;
  const es = new EventSource(url);
  _es = es;

  es.addEventListener('connected', () => {
    _reconnectDelay = RECONNECT_DELAY_MS;
    _dispatch({ type: 'connected' });
  });

  es.addEventListener('drivers', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as Driver[];
      _dispatch({ type: 'drivers', data });
    } catch { /* ignore malformed */ }
  });

  es.addEventListener('drowsiness', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as DrowsinessResponse;
      _dispatch({ type: 'drowsiness', data });
    } catch { /* ignore malformed */ }
  });

  es.addEventListener('session', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as { is_live: boolean };
      _dispatch({ type: 'session', data });
    } catch { /* ignore malformed */ }
  });

  es.addEventListener('retrain', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as RetrainEvent;
      _dispatch({ type: 'retrain', data });
    } catch { /* ignore malformed */ }
  });

  es.addEventListener('prediction', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as { zone_id: string; level: string; predicted_demand: number; ts: string };
      _dispatch({ type: 'prediction', data });
    } catch { /* ignore malformed */ }
  });

  es.onerror = () => {
    es.close();
    if (_es === es) _es = null;
    // Schedule reconnection with exponential backoff
    _reconnectTimer = setTimeout(() => {
      _reconnectDelay = Math.min(_reconnectDelay * 1.5, MAX_RECONNECT_DELAY_MS);
      if (_subscribers.size > 0) _createStream();
    }, _reconnectDelay);
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveStream(handlers: LiveStreamHandlers) {
  // Keep a ref so the subscriber closure always calls the latest handlers
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let connected = false;

    const subscriber: Subscriber = (event) => {
      const h = handlersRef.current;
      switch (event.type) {
        case 'connected':
          connected = true;
          h.onConnected?.();
          break;
        case 'drivers':
          h.onDrivers?.(event.data);
          break;
        case 'drowsiness':
          h.onDrowsiness?.(event.data);
          break;
        case 'session':
          if (!event.data.is_live && connected) {
            connected = false;
            h.onDisconnected?.();
          }
          h.onSession?.(event.data);
          break;
        case 'retrain':
          h.onRetrain?.(event.data);
          break;
        case 'prediction':
          h.onPrediction?.(event.data);
          break;
      }
    };

    _subscribers.add(subscriber);
    _createStream(); // no-op if already open

    return () => {
      _subscribers.delete(subscriber);
      if (_subscribers.size === 0) {
        // Last subscriber gone — tear down the stream
        _destroyStream();
        _reconnectDelay = RECONNECT_DELAY_MS;
      }
      if (connected) {
        handlersRef.current.onDisconnected?.();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
