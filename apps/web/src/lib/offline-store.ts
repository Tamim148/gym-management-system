'use client';

import type { QrPassPayload } from '@vintage/shared';

const DB_NAME = 'va_gym_offline_db';
const DB_VERSION = 1;
const QR_PASS_STORE = 'qrPass';
const OFFLINE_QUEUE_STORE = 'offlineQueue';

export interface CachedQrPass extends QrPassPayload {
  cachedAt: string;
  memberName?: string;
  branchName?: string;
  planName?: string;
}

export interface OfflineQueuedEvent {
  id: string;
  branchId: string;
  kind: 'CARD_TAP' | 'MANUAL_OVERRIDE';
  cardUid?: string;
  userId?: string;
  scannedAt: string;
  overrideReason?: string;
  overrideNotes?: string;
}

function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QR_PASS_STORE)) {
        db.createObjectStore(QR_PASS_STORE, { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function cacheQrPass(pass: CachedQrPass): Promise<void> {
  if (!isIndexedDbSupported()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QR_PASS_STORE, 'readwrite');
      tx.objectStore(QR_PASS_STORE).put(pass);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal in private browsing / restricted environments
  }
}

export async function getCachedQrPass(userId?: string): Promise<CachedQrPass | null> {
  if (!isIndexedDbSupported()) return null;
  try {
    const db = await openDatabase();
    const result = await new Promise<CachedQrPass | null>((resolve, reject) => {
      const tx = db.transaction(QR_PASS_STORE, 'readonly');
      const store = tx.objectStore(QR_PASS_STORE);
      const req = userId ? store.get(userId) : store.getAll();
      req.onsuccess = () => {
        if (userId) {
          resolve((req.result as CachedQrPass | undefined) ?? null);
        } else {
          const all = req.result as CachedQrPass[];
          resolve(all.length > 0 ? all[0] : null);
        }
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function enqueueOfflineEvent(event: OfflineQueuedEvent): Promise<void> {
  if (!isIndexedDbSupported()) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_QUEUE_STORE).put(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getOfflineQueue(branchId?: string): Promise<OfflineQueuedEvent[]> {
  if (!isIndexedDbSupported()) return [];
  try {
    const db = await openDatabase();
    const rows = await new Promise<OfflineQueuedEvent[]>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
      const req = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
      req.onsuccess = () => resolve((req.result as OfflineQueuedEvent[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return branchId ? rows.filter((r) => r.branchId === branchId) : rows;
  } catch {
    return [];
  }
}

export async function clearOfflineQueue(branchId?: string): Promise<void> {
  if (!isIndexedDbSupported()) return;
  const db = await openDatabase();
  if (!branchId) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
      tx.objectStore(OFFLINE_QUEUE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return;
  }

  const all = await getOfflineQueue();
  const toDelete = all.filter((item) => item.branchId === branchId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_QUEUE_STORE);
    for (const item of toDelete) {
      store.delete(item.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function wipeOfflineStorage(): Promise<void> {
  if (!isIndexedDbSupported()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([QR_PASS_STORE, OFFLINE_QUEUE_STORE], 'readwrite');
      tx.objectStore(QR_PASS_STORE).clear();
      tx.objectStore(OFFLINE_QUEUE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Fallback to deleting the entire database
    window.indexedDB.deleteDatabase(DB_NAME);
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'WIPE_CACHES' });
  }
}
