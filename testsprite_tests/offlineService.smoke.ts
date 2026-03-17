import { offlineService } from '../src/services/offlineService';

async function runOfflineServiceSmoke() {
  const cacheProbe = {
    probe: 'hotspots-cache',
    timestamp: new Date().toISOString(),
  };

  await offlineService.saveToCache('hotspots', cacheProbe);
  const cached = await offlineService.getFromCache<typeof cacheProbe>('hotspots');

  if (!cached || cached.probe !== cacheProbe.probe) {
    throw new Error('OfflineService cache round-trip failed.');
  }

  const queueSizeBefore = await offlineService.getSyncQueueSize();
  await offlineService.addToSyncQueue('driver-session', { is_live: true });
  const queueSizeAfter = await offlineService.getSyncQueueSize();

  if (queueSizeAfter <= queueSizeBefore) {
    throw new Error('OfflineService queue insert failed.');
  }

  console.log('OfflineService smoke test passed.', {
    cacheProbe: cached,
    queueSizeBefore,
    queueSizeAfter,
  });
}

void runOfflineServiceSmoke().catch((error) => {
  console.error('OfflineService smoke test failed.', error);
});
