import { processSyncQueueEntries, SyncAction, SyncQueueEntry } from './syncEngine';
import { API_BASE_URL } from '../config/api';
import { mockPostDriverSession, mockPostDrowsinessStatus } from './mockApi';
import { DriverSessionTogglePayload, DrowsinessUpdatePayload } from '../types';

export type CacheStoreName = 'hotspots' | 'metrics' | 'forecast';

interface CacheRecord<TData> {
  key: CacheStoreName;
  data: TData;
  updatedAt: string;
}

export interface SyncProcessResult {
  processed: number;
  synced: number;
  failed: number;
  pending: number;
}

const DB_NAME = 'grid-driver-offline';
const DB_VERSION = 1;
const SYNC_QUEUE_STORE = 'sync_queue';
const CACHE_STORES: CacheStoreName[] = ['hotspots', 'metrics', 'forecast'];
export const OFFLINE_QUEUE_EVENT = 'grid-offline-queue-changed';

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function isBrowserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function isRecoverableSyncError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('load failed') ||
    message.includes('status 404') ||
    message.includes('status 500') ||
    message.includes('status 502') ||
    message.includes('status 503')
  );
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

class OfflineService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private emitQueueChanged() {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
  }

  private async getDb() {
    if (!hasIndexedDb()) {
      throw new Error('IndexedDB is not available in this browser.');
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;

          CACHE_STORES.forEach((storeName) => {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: 'key' });
            }
          });

          if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
            db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
      });
    }

    return this.dbPromise;
  }

  async saveToCache<TData>(key: CacheStoreName, data: TData) {
    const db = await this.getDb();
    const transaction = db.transaction(key, 'readwrite');
    const store = transaction.objectStore(key);

    store.put({
      key,
      data,
      updatedAt: new Date().toISOString(),
    } satisfies CacheRecord<TData>);

    await transactionToPromise(transaction);
  }

  async getFromCache<TData>(key: CacheStoreName): Promise<TData | null> {
    const db = await this.getDb();
    const transaction = db.transaction(key, 'readonly');
    const store = transaction.objectStore(key);
    const record = await requestToPromise<CacheRecord<TData> | undefined>(store.get(key));

    await transactionToPromise(transaction);
    return record?.data ?? null;
  }

  async addToSyncQueue<TPayload>(action: SyncAction, payload: TPayload) {
    const db = await this.getDb();
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);

    const id = await requestToPromise<IDBValidKey>(
      store.add({
        action,
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastAttemptAt: null,
        lastError: null,
      } satisfies SyncQueueEntry<TPayload>),
    );

    await transactionToPromise(transaction);
    this.emitQueueChanged();

    return Number(id);
  }

  async getSyncQueue(): Promise<SyncQueueEntry[]> {
    const db = await this.getDb();
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const records = await requestToPromise<SyncQueueEntry[]>(store.getAll());

    await transactionToPromise(transaction);

    return [...records].sort((left, right) => (left.id ?? 0) - (right.id ?? 0));
  }

  async getSyncQueueSize() {
    const db = await this.getDb();
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const count = await requestToPromise<number>(store.count());

    await transactionToPromise(transaction);
    return count;
  }

  private async deleteSyncQueueEntries(ids: number[]) {
    if (!ids.length) {
      return;
    }

    const db = await this.getDb();
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);

    ids.forEach((id) => store.delete(id));
    await transactionToPromise(transaction);
  }

  private async updateSyncQueueEntry(entry: SyncQueueEntry) {
    if (typeof entry.id !== 'number') {
      return;
    }

    const db = await this.getDb();
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);

    store.put(entry);
    await transactionToPromise(transaction);
  }

  private async sendQueuedRequest(entry: SyncQueueEntry) {
    let path = '';
    let mockFallback: (() => Promise<unknown>) | null = null;

    switch (entry.action) {
      case 'driver-drowsiness':
        path = '/driver/drowsiness';
        mockFallback = () => mockPostDrowsinessStatus(entry.payload as DrowsinessUpdatePayload);
        break;
      case 'driver-session':
        path = '/driver/session';
        mockFallback = () => mockPostDriverSession(entry.payload as DriverSessionTogglePayload);
        break;
      default:
        throw new Error(`Unsupported sync action: ${entry.action}`);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry.payload),
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status ${response.status}`);
      }
    } catch (error) {
      if (!mockFallback || !isRecoverableSyncError(error)) {
        throw error;
      }

      await mockFallback();
    }
  }

  async processSyncQueue(): Promise<SyncProcessResult> {
    const pendingBefore = await this.getSyncQueueSize();
    if (!pendingBefore) {
      return {
        processed: 0,
        synced: 0,
        failed: 0,
        pending: 0,
      };
    }

    if (!isBrowserOnline()) {
      return {
        processed: 0,
        synced: 0,
        failed: 0,
        pending: pendingBefore,
      };
    }

    const entries = await this.getSyncQueue();
    const result = await processSyncQueueEntries(entries, (entry) => this.sendQueuedRequest(entry));

    await this.deleteSyncQueueEntries(result.successfulIds);

    for (const failedEntry of result.failedEntries) {
      await this.updateSyncQueueEntry(failedEntry);
    }

    const pending = await this.getSyncQueueSize();
    this.emitQueueChanged();

    return {
      processed: entries.length,
      synced: result.successfulIds.length,
      failed: result.failedEntries.length,
      pending,
    };
  }
}

export const offlineService = new OfflineService();
