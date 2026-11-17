'use client';

import { useEffect, useState } from 'react';
import type { Reading, User } from './types';

// A copy of the account and readings kept on this device, so readings can
// still be opened without internet. IndexedDB, because palm photos make
// readings too large for localStorage.
const DB = 'jotaish';
const STORE = 'offline';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Storage blocked (private browsing): offline copies just aren't kept.
    return undefined;
  }
}

const get = <T>(key: string) => run<T>('readonly', (s) => s.get(key));
const put = (key: string, value: unknown) => run('readwrite', (s) => s.put(value, key));

export const saveUser = (user: User) => put('user', user);
export const savedUser = () => get<User>('user');
export const saveReadingList = (list: Reading[]) => put('readings', list);
export const savedReadingList = () => get<Reading[]>('readings');
export const saveReading = (reading: Reading) => put(`reading:${reading.id}`, reading);
export const savedReading = (id: string) => get<Reading>(`reading:${id}`);

// Waits for the service worker, so even the first visit keeps its pages.
function tellWorker(message: unknown) {
  if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
  void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage(message));
}

// Signing out removes everything kept for offline use.
export async function clearOffline() {
  await run('readwrite', (s) => s.clear());
  tellWorker({ type: 'clear-pages' });
}

// Asks the service worker to keep these pages, so they open offline.
export function keepPages(paths: string[]) {
  tellWorker({ type: 'keep-pages', paths });
}

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
