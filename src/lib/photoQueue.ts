// IndexedDB-Warteschlange für Foto-Uploads, die bei Verbindungsverlust
// nicht abgeschlossen werden konnten. Die Blobs liegen vollständig in der
// DB; ein Worker im Hook holt sie nach, sobald wieder Online + Session da
// sind. Pro Benutzer+Check kann nur ein Eintrag existieren (neuestes Foto
// gewinnt).

export type QueuedPhoto = {
  key: string // `${userId}|${weekStart}|${checkId}`
  userId: string
  weekStart: string
  checkId: string
  blob: Blob
  enqueuedAt: number
}

const DB_NAME = 'fitplan-photo-queue'
const DB_VERSION = 1
const STORE = 'pending'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex('userId', 'userId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Fehler.'))
  })
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Fehler.'))
  })
}

const queueKey = (userId: string, weekStart: string, checkId: string) =>
  `${userId}|${weekStart}|${checkId}`

/** Legt (oder ersetzt) den Warteschlangen-Eintrag für eine Mahlzeit ab. */
export async function enqueuePhoto(entry: Omit<QueuedPhoto, 'key' | 'enqueuedAt'>): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const record: QueuedPhoto = {
      ...entry,
      key: queueKey(entry.userId, entry.weekStart, entry.checkId),
      enqueuedAt: Date.now(),
    }
    await requestAsPromise(tx.objectStore(STORE).put(record))
  } finally {
    db.close()
  }
}

/** Alle Warteschlangen-Einträge eines Benutzers, älteste zuerst. */
export async function listQueuedPhotos(userId: string): Promise<QueuedPhoto[]> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readonly')
    const index = tx.objectStore(STORE).index('userId')
    const entries = await requestAsPromise(index.getAll(userId))
    return entries.sort((a, b) => a.enqueuedAt - b.enqueuedAt)
  } finally {
    db.close()
  }
}

/** Entfernt einen abgeschlossenen Warteschlangen-Eintrag. */
export async function dequeuePhoto(
  userId: string,
  weekStart: string,
  checkId: string,
): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    await requestAsPromise(tx.objectStore(STORE).delete(queueKey(userId, weekStart, checkId)))
  } finally {
    db.close()
  }
}

/** Anzahl wartender Foto-Uploads eines Benutzers (für das UI-Badge). */
export async function countQueuedPhotos(userId: string): Promise<number> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readonly')
    const index = tx.objectStore(STORE).index('userId')
    return await requestAsPromise(index.count(userId))
  } finally {
    db.close()
  }
}
