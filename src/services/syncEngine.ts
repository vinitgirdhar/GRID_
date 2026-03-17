export type SyncAction = 'driver-drowsiness' | 'driver-session';

export interface SyncQueueEntry<TPayload = unknown> {
  id?: number;
  action: SyncAction;
  payload: TPayload;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string | null;
  lastError?: string | null;
}

export interface SyncQueueRunResult {
  successfulIds: number[];
  failedEntries: SyncQueueEntry[];
}

export function isNetworkLikeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('load failed')
  );
}

export async function processSyncQueueEntries(
  entries: SyncQueueEntry[],
  processor: (entry: SyncQueueEntry) => Promise<void>,
): Promise<SyncQueueRunResult> {
  const successfulIds: number[] = [];
  const failedEntries: SyncQueueEntry[] = [];

  for (const entry of entries) {
    try {
      await processor(entry);
      if (typeof entry.id === 'number') {
        successfulIds.push(entry.id);
      }
    } catch (error) {
      failedEntries.push({
        ...entry,
        attempts: entry.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : 'Unknown sync failure',
      });

      if (isNetworkLikeError(error)) {
        break;
      }
    }
  }

  return {
    successfulIds,
    failedEntries,
  };
}
