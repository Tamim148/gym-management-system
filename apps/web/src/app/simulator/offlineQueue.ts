export interface QueuedOfflineEvent {
  id: string;
  branchId: string;
  kind: 'CARD_TAP' | 'MANUAL_OVERRIDE';
  cardUid?: string;
  userId?: string;
  scannedAt: string;
  overrideReason?: string;
  overrideNotes?: string;
}

const DB_NAME = 'vintage_aesthetics_simulator';
const STORE_NAME = 'offline_access_queue';
const DB_VERSION = 1;

let memoryFallbackQueue: QueuedOfflineEvent[] = [];

function openQueueDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function enqueueOfflineEvent(
  event: QueuedOfflineEvent,
): Promise<void> {
  const db = await openQueueDb();
  if (!db) {
    if (!memoryFallbackQueue.some((e) => e.id === event.id)) {
      memoryFallbackQueue.push(event);
    }
    return;
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(event);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}

export async function listOfflineEvents(
  branchId?: string,
): Promise<QueuedOfflineEvent[]> {
  const db = await openQueueDb();
  if (!db) {
    return branchId
      ? memoryFallbackQueue.filter((e) => e.branchId === branchId)
      : [...memoryFallbackQueue];
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const items = (req.result as QueuedOfflineEvent[]) || [];
      db.close();
      resolve(
        branchId ? items.filter((item) => item.branchId === branchId) : items,
      );
    };
    req.onerror = () => {
      db.close();
      resolve([]);
    };
  });
}

export async function removeOfflineEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  memoryFallbackQueue = memoryFallbackQueue.filter((e) => !idSet.has(e.id));

  const db = await openQueueDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}
